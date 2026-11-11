#!/usr/bin/env python3
"""
Fine-Tuning Script for NASA Microgravity Flammability Prediction
Fine-tunes Qwen-0.6B using LoRA (Low-Rank Adaptation) on Apple Silicon MPS.
Predicts flammability regimes:
0: Sustained Burn
1: Radiative Extinction
2: Blowoff
"""

import os
import json
import torch
import numpy as np
import pandas as pd
from torch.utils.data import Dataset, DataLoader
from transformers import AutoTokenizer, AutoModelForSequenceClassification, get_cosine_schedule_with_warmup
from peft import LoraConfig, get_peft_model, TaskType
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, f1_score, classification_report, confusion_matrix

BASE_MODEL_PATH = "/Users/simanto/.cache/huggingface/hub/models--Qwen--Qwen3-0.6B/snapshots/c1899de289a04d12100db370d81485cdf75e47ca"
OUTPUT_DIR = "models/fine_tuned_qwen_flammability"

LABEL2ID = {
    "Sustained Burn": 0,
    "Radiative Extinction": 1,
    "Blowoff": 2
}
ID2LABEL = {v: k for k, v in LABEL2ID.items()}

def generate_augmented_training_samples():
    """
    Combines BASS-II flight runs and published NASA empirical boundary points
    into structured textual prompt representations with physics dimensionless numbers.
    """
    df_master = pd.read_csv("data/flammability_master_dataset.csv")
    samples = []
    
    for _, r in df_master.iterrows():
        status = r["flammability_status"]
        if status not in LABEL2ID:
            continue
            
        mat = r["sample_material"]
        thk = float(r["sample_thickness_mm"])
        flow = float(r["airflow_velocity_cms"])
        o2 = float(r["O2_concentration_pct"])
        p = float(r["cabin_pressure_psi"])
        
        da = (o2 / 21.0) / (1.0 + (flow / 6.0)**1.5)
        rad = 1.0 / (max(0.2, flow) * max(0.1, o2 / 21.0))
        
        prompt = (f"NASA Microgravity Combustion Mission. Material: {mat}. "
                  f"Fuel Thickness: {thk:.1f} mm. Forced Airflow Velocity: {flow:.1f} cm/s. "
                  f"Oxygen Concentration: {o2:.1f}% O2. Cabin Pressure: {p:.1f} psi. "
                  f"Damköhler Reaction Proxy: {da:.2f}. Radiative Loss Index: {rad:.2f}. "
                  f"Gravity: Microgravity (0 g, absence of natural buoyant updraft). "
                  f"What is the flame-spread flammability regime?")
                  
        samples.append({
            "text": prompt,
            "label": LABEL2ID[status],
            "status": status,
            "material": mat,
            "o2": o2,
            "flow": flow,
            "pressure": p
        })

    # Add systematic physical boundary conditions from peer-reviewed NASA reports:
    # 1. Below LOC (< 17.5% for PMMA, < 26% for Nomex, < 16.5% for Cotton) -> Radiative Extinction
    # 2. High flow (> 18 cm/s) and sub-ambient O2 -> Blowoff
    # 3. Flammable envelope (moderate flow 3-12 cm/s, O2 > LOC) -> Sustained Burn
    
    augmented_configs = [
        # Sub-LOC Radiative Extinction boundary conditions (NASA-TM-20160012691)
        ("PMMA", 2.5, 4.0, 16.0, 14.7, "Radiative Extinction"),
        ("PMMA", 3.0, 6.0, 17.0, 14.7, "Radiative Extinction"),
        ("PMMA", 1.5, 2.0, 17.5, 14.7, "Radiative Extinction"),
        ("PMMA", 2.0, 8.0, 15.5, 10.2, "Radiative Extinction"),
        ("PMMA", 4.0, 5.0, 16.8, 14.7, "Radiative Extinction"),
        ("Nomex", 2.0, 6.0, 21.0, 14.7, "Radiative Extinction"),
        ("Nomex", 2.5, 8.0, 23.0, 14.7, "Radiative Extinction"),
        ("Nomex", 1.5, 5.0, 18.0, 10.2, "Radiative Extinction"),
        ("Cotton-Fiber Blend", 2.0, 3.0, 15.5, 14.7, "Radiative Extinction"),
        ("Cotton-Fiber Blend", 3.0, 5.0, 16.0, 10.2, "Radiative Extinction"),
        
        # High Flow Blowoff boundary conditions (NASA-TM-20170006615)
        ("PMMA", 2.0, 20.0, 21.0, 14.7, "Blowoff"),
        ("PMMA", 2.5, 22.0, 24.0, 14.7, "Blowoff"),
        ("PMMA", 1.5, 19.5, 18.0, 14.7, "Blowoff"),
        ("PMMA", 3.0, 21.0, 20.0, 10.2, "Blowoff"),
        ("Nomex", 2.0, 19.0, 28.0, 14.7, "Blowoff"),
        ("Nomex", 2.5, 22.0, 30.0, 14.7, "Blowoff"),
        ("Cotton-Fiber Blend", 2.0, 20.0, 21.0, 14.7, "Blowoff"),
        ("Cotton-Fiber Blend", 2.5, 22.0, 23.0, 10.2, "Blowoff"),
        
        # Flammable Sustained Burn conditions (NASA-TM-20150008961)
        ("PMMA", 2.5, 7.5, 21.0, 14.7, "Sustained Burn"),
        ("PMMA", 2.0, 8.0, 25.0, 14.7, "Sustained Burn"),
        ("PMMA", 3.0, 6.0, 28.0, 10.2, "Sustained Burn"),
        ("PMMA", 1.5, 5.0, 30.0, 14.7, "Sustained Burn"),
        ("PMMA", 2.5, 10.0, 34.0, 10.2, "Sustained Burn"),
        ("Nomex", 2.0, 10.0, 30.0, 14.7, "Sustained Burn"),
        ("Nomex", 2.5, 8.0, 32.0, 14.7, "Sustained Burn"),
        ("Nomex", 1.5, 9.0, 34.0, 10.2, "Sustained Burn"),
        ("Cotton-Fiber Blend", 2.0, 6.0, 21.0, 14.7, "Sustained Burn"),
        ("Cotton-Fiber Blend", 3.0, 8.0, 24.0, 14.7, "Sustained Burn"),
        ("Cotton-Fiber Blend", 2.5, 5.0, 28.0, 10.2, "Sustained Burn")
    ]
    
    for mat, thk, flow, o2, p, status in augmented_configs:
        da = (o2 / 21.0) / (1.0 + (flow / 6.0)**1.5)
        rad = 1.0 / (max(0.2, flow) * max(0.1, o2 / 21.0))
        prompt = (f"NASA Microgravity Combustion Mission. Material: {mat}. "
                  f"Fuel Thickness: {thk:.1f} mm. Forced Airflow Velocity: {flow:.1f} cm/s. "
                  f"Oxygen Concentration: {o2:.1f}% O2. Cabin Pressure: {p:.1f} psi. "
                  f"Damköhler Reaction Proxy: {da:.2f}. Radiative Loss Index: {rad:.2f}. "
                  f"Gravity: Microgravity (0 g, absence of natural buoyant updraft). "
                  f"What is the flame-spread flammability regime?")
        samples.append({
            "text": prompt,
            "label": LABEL2ID[status],
            "status": status,
            "material": mat,
            "o2": o2,
            "flow": flow,
            "pressure": p
        })
        
    return pd.DataFrame(samples)

class MicrogravityDataset(Dataset):
    def __init__(self, texts, labels, tokenizer, max_len=128):
        self.texts = texts
        self.labels = labels
        self.tokenizer = tokenizer
        self.max_len = max_len

    def __len__(self):
        return len(self.texts)

    def __getitem__(self, idx):
        text = str(self.texts[idx])
        label = int(self.labels[idx])
        encoding = self.tokenizer(
            text,
            truncation=True,
            padding="max_length",
            max_length=self.max_len,
            return_tensors="pt"
        )
        return {
            "input_ids": encoding["input_ids"].squeeze(0),
            "attention_mask": encoding["attention_mask"].squeeze(0),
            "labels": torch.tensor(label, dtype=torch.long)
        }

def train_fine_tuned_model():
    print("=" * 70)
    print("🚀 Commencing Fine-Tuning of Qwen-0.6B on NASA Microgravity Combustion")
    print("=" * 70)
    
    device = "mps" if torch.backends.mps.is_available() else "cpu"
    print(f"Hardware Acceleration Device: {device.upper()}")
    
    # 1. Load Tokenizer
    print("\nLoading Qwen Tokenizer...")
    tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL_PATH)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
        
    # 2. Build Dataset
    print("Preparing dataset with physics-guided representations...")
    df_data = generate_augmented_training_samples()
    print(f"Total structured combustion examples: {len(df_data)}")
    print("Class distribution:", df_data["status"].value_counts().to_dict())
    
    # Stratified Train/Val/Test Split
    train_df, test_df = train_test_split(
        df_data, test_size=0.20, random_state=42, stratify=df_data["label"]
    )
    train_df, val_df = train_test_split(
        train_df, test_size=0.15, random_state=42, stratify=train_df["label"]
    )
    
    print(f"Train set: {len(train_df)}, Val set: {len(val_df)}, Test set: {len(test_df)}")
    
    train_dataset = MicrogravityDataset(train_df["text"].tolist(), train_df["label"].tolist(), tokenizer)
    val_dataset = MicrogravityDataset(val_df["text"].tolist(), val_df["label"].tolist(), tokenizer)
    test_dataset = MicrogravityDataset(test_df["text"].tolist(), test_df["label"].tolist(), tokenizer)
    
    train_loader = DataLoader(train_dataset, batch_size=8, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=8, shuffle=False)
    test_loader = DataLoader(test_dataset, batch_size=8, shuffle=False)
    
    # 3. Load Model & Apply LoRA
    print("\nLoading Qwen3ForSequenceClassification and configuring LoRA PEFT...")
    base_model = AutoModelForSequenceClassification.from_pretrained(
        BASE_MODEL_PATH,
        num_labels=3,
        id2label=ID2LABEL,
        label2id=LABEL2ID
    )
    base_model.config.pad_token_id = tokenizer.pad_token_id
    
    peft_config = LoraConfig(
        task_type=TaskType.SEQ_CLS,
        r=8,
        lora_alpha=16,
        lora_dropout=0.05,
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj"]
    )
    model = get_peft_model(base_model, peft_config)
    model.print_trainable_parameters()
    model.to(device)
    
    # 4. Training Hyperparameters
    epochs = 12
    optimizer = torch.optim.AdamW(model.parameters(), lr=2e-4, weight_decay=0.01)
    total_steps = len(train_loader) * epochs
    scheduler = get_cosine_schedule_with_warmup(optimizer, num_warmup_steps=int(0.1*total_steps), num_training_steps=total_steps)
    
    best_val_acc = 0.0
    best_state_dict = None
    training_history = []
    
    print("\nStarting Training Loop...")
    for epoch in range(1, epochs + 1):
        model.train()
        total_train_loss = 0.0
        
        for batch in train_loader:
            optimizer.zero_grad()
            input_ids = batch["input_ids"].to(device)
            attention_mask = batch["attention_mask"].to(device)
            labels = batch["labels"].to(device)
            
            outputs = model(input_ids=input_ids, attention_mask=attention_mask, labels=labels)
            loss = outputs.loss
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()
            scheduler.step()
            
            total_train_loss += loss.item()
            
        avg_train_loss = total_train_loss / len(train_loader)
        
        # Validation
        model.eval()
        val_preds, val_targets = [], []
        with torch.no_grad():
            for batch in val_loader:
                input_ids = batch["input_ids"].to(device)
                attention_mask = batch["attention_mask"].to(device)
                labels = batch["labels"].to(device)
                
                outputs = model(input_ids=input_ids, attention_mask=attention_mask)
                preds = torch.argmax(outputs.logits, dim=-1).cpu().numpy()
                val_preds.extend(preds)
                val_targets.extend(labels.cpu().numpy())
                
        val_acc = accuracy_score(val_targets, val_preds)
        val_f1 = f1_score(val_targets, val_preds, average="macro")
        
        print(f"Epoch {epoch:2d}/{epochs:2d} | Train Loss: {avg_train_loss:.4f} | Val Acc: {val_acc*100:.1f}% | Val F1: {val_f1*100:.1f}%")
        training_history.append({
            "epoch": epoch,
            "train_loss": avg_train_loss,
            "val_accuracy": val_acc,
            "val_f1": val_f1
        })
        
        if val_acc >= best_val_acc:
            best_val_acc = val_acc
            best_state_dict = model.state_dict()

    # 5. Holdout Test Set Evaluation
    print("\n=== Evaluating Best Checkpoint on Holdout Test Set ===")
    if best_state_dict is not None:
        model.load_state_dict(best_state_dict)
        
    model.eval()
    test_preds, test_targets = [], []
    with torch.no_grad():
        for batch in test_loader:
            input_ids = batch["input_ids"].to(device)
            attention_mask = batch["attention_mask"].to(device)
            labels = batch["labels"].to(device)
            
            outputs = model(input_ids=input_ids, attention_mask=attention_mask)
            preds = torch.argmax(outputs.logits, dim=-1).cpu().numpy()
            test_preds.extend(preds)
            test_targets.extend(labels.cpu().numpy())
            
    test_acc = accuracy_score(test_targets, test_preds)
    test_f1 = f1_score(test_targets, test_preds, average="macro")
    print(f"Test Accuracy: {test_acc*100:.2f}% | Test Macro F1: {test_f1*100:.2f}%")
    
    target_names = [ID2LABEL[i] for i in range(3)]
    report = classification_report(test_targets, test_preds, target_names=target_names, output_dict=True)
    print("\nClassification Report:")
    print(classification_report(test_targets, test_preds, target_names=target_names))
    
    cm = confusion_matrix(test_targets, test_preds)
    
    # 6. Save Fine-Tuned Model & Artifacts
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    print(f"Saving fine-tuned model and adapter weights to {OUTPUT_DIR}/...")
    model.save_pretrained(OUTPUT_DIR)
    tokenizer.save_pretrained(OUTPUT_DIR)
    
    metrics_export = {
        "model_name": "Fine-Tuned Qwen-0.6B LoRA Flammability Classifier",
        "base_model": "Qwen/Qwen3-0.6B",
        "task": "Microgravity Flame-Spread Regime Prediction",
        "device": device,
        "epochs": epochs,
        "best_val_accuracy": round(float(best_val_acc), 4),
        "test_accuracy": round(float(test_acc), 4),
        "test_macro_f1": round(float(test_f1), 4),
        "classes": target_names,
        "confusion_matrix": cm.tolist(),
        "classification_report": report,
        "training_history": training_history
    }
    
    with open(os.path.join(OUTPUT_DIR, "evaluation_metrics.json"), "w") as f:
        json.dump(metrics_export, f, indent=2)
    with open("rag/transformer_model_metrics.json", "w") as f:
        json.dump(metrics_export, f, indent=2)
        
    print(f"✅ Fine-Tuning Complete! Saved model to {OUTPUT_DIR}")
    return model, tokenizer, metrics_export

if __name__ == "__main__":
    train_fine_tuned_model()

