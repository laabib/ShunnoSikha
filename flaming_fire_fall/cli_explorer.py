#!/usr/bin/env python3
"""
Flammability Explorer CLI & Killer Demo Runner
Run interactive predictions, execute the killer demo boundary slide (21% -> 17% O2),
query the NASA Technical Reports RAG system, or inspect honest model training metrics.
"""

import sys
import argparse
import json
import time
from flammability_model import FlammabilityPredictor
from rag.rag_engine import MicrogravityRAGEngine

def run_killer_demo(model_type="pinn"):
    print("=" * 75)
    print("🚀 NASA MICROGRAVITY FLAMMABILITY EXPLORER - KILLER DEMO")
    print("Demonstration: Sliding Oxygen Concentration from 21.0% down to 17.0%")
    print(f"Model Architecture: {model_type.upper()}")
    print("Material: Polymethylmethacrylate (PMMA) | Flow Velocity: 7.5 cm/s | Pressure: 14.7 psi")
    print("=" * 75)
    
    predictor = FlammabilityPredictor(model_type)
    rag = MicrogravityRAGEngine()
    
    steps = [21.0, 20.0, 19.0, 18.2, 17.8, 17.0]
    
    print("\n[Phase 1] Executing Dynamic Oxygen Concentration Slide:\n")
    print(f"{'Oxygen %':<10} | {'Predicted Regime':<22} | {'Sustained P(%)':<15} | {'Extinction P(%)':<16} | {'Status'}")
    print("-" * 75)
    
    boundary_crossed = False
    boundary_o2 = None
    
    for o2 in steps:
        res = predictor.predict(
            material="PMMA",
            o2_pct=o2,
            flow_cms=7.5,
            pressure_psi=14.7,
            thickness_mm=2.5
        )
        regime = res["predicted_regime"]
        p_sust = res["probabilities"].get("Sustained Burn", 0.0) * 100
        p_ext = res["probabilities"].get("Radiative Extinction", 0.0) * 100
        
        status_note = ""
        if regime == "Radiative Extinction" and not boundary_crossed:
            boundary_crossed = True
            boundary_o2 = o2
            status_note = "⚡ BOUNDARY CROSSED!"
            
        print(f"{o2:<10.1f} | {regime:<22} | {p_sust:<15.1f} | {p_ext:<16.1f} | {status_note}")
        time.sleep(0.15)
        
    print("-" * 75)
    print(f"\n[Phase 2] RAG Automated Explanation Layer (Triggered at O2 = 17.0%):\n")
    
    explanation = rag.explain_boundary_crossing(
        material="PMMA",
        flow_cms=7.5,
        pressure_psi=14.7,
        o2_from=21.0,
        o2_to=17.0
    )
    
    print(explanation["explanation_markdown"])
    
    print("\n" + "=" * 75)
    print("📑 VERIFIED NASA TECHNICAL REPORTS ON EITHER SIDE OF BOUNDARY:")
    print("=" * 75)
    for rep in explanation["seminal_reports"]:
        print(f"▶ Report ID: {rep['report_id']}")
        print(f"  Title:     {rep['title']}")
        print(f"  Authors:   {rep['authors']}")
        print(f"  Relevance: {rep['relevance']}")
        print(f"  URL:       {rep['url']}\n")

def run_prediction(args):
    predictor = FlammabilityPredictor(args.model)
    res = predictor.predict(
        material=args.material,
        o2_pct=args.o2,
        flow_cms=args.flow,
        pressure_psi=args.pressure,
        thickness_mm=args.thickness
    )
    print("\n=== FLAMMABILITY REGIME PREDICTION ===")
    print(f"Model Architecture:   {res.get('model_type', args.model)}")
    print(f"Material:             {args.material}")
    print(f"Oxygen Concentration: {args.o2:.1f} %")
    print(f"Flow Velocity:        {args.flow:.1f} cm/s")
    print(f"Cabin Pressure:       {args.pressure:.1f} psi")
    print(f"Sample Thickness:     {args.thickness:.1f} mm")
    print("-" * 40)
    print(f"PREDICTED REGIME:     👉 {res['predicted_regime'].upper()} 👈")
    print("\nClass Probabilities:")
    for k, v in res["probabilities"].items():
        print(f"  - {k:<22}: {v*100:5.1f} %")

def run_rag_search(query):
    print(f"\n=== NASA Microgravity Literature Search: '{query}' ===")
    rag = MicrogravityRAGEngine()
    docs = rag.retrieve(query, top_k=5)
    if not docs:
        print("No documents found matching query.")
        return
        
    for i, d in enumerate(docs, 1):
        print(f"\n[{i}] {d.get('title')} ({d.get('report_id')})")
        print(f"    Authors: {', '.join(d.get('authors', [])[:3])}")
        print(f"    Date:    {d.get('publication_date')}")
        print(f"    Link:    {d.get('nasa_url')}")
        snippet = d.get('text') or d.get('abstract', '')
        # Clean newlines for terminal snippet
        snippet_clean = " ".join(snippet.split())[:240]
        print(f"    Page:    {d.get('page_num', 'N/A')}")
        print(f"    Snippet: {snippet_clean}...")

def show_metrics():
    print("\n=== MODEL VALIDATION & TRAINING METRICS ===")
    with open("rag/model_metrics.json") as f:
        metrics = json.load(f)
    print(f"Model Architecture: {metrics['model_architecture']}")
    print("\nStratified 5-Fold Cross-Validation:")
    cv = metrics["cross_validation"]
    print(f"  - Mean Accuracy: {cv['mean_accuracy']*100:.2f}% (+/- {cv['std_accuracy']*100:.2f}%)")
    print(f"  - Mean Macro F1: {cv['mean_macro_f1']*100:.2f}%")
    print(f"  - Fold Accuracies: {cv['fold_accuracies']}")
    
    print("\nTop Feature Importances:")
    for f, imp in list(metrics["feature_importances"].items())[:6]:
        print(f"  - {f:<25}: {imp:.4f}")
        
    print("\nTraining Dataset Breakdown:")
    ts = metrics["training_dataset_summary"]
    print(f"  - Total Samples: {ts['total_records']}")
    print(f"  - Classes: {ts['classes_distribution']}")
    print(f"  - Materials: {ts['materials_distribution']}")

def main():
    parser = argparse.ArgumentParser(description="Microgravity Flammability Explorer CLI")
    parser.add_argument("--demo", action="store_true", help="Run the killer demo (O2 slide 21%% to 17%%)")
    parser.add_argument("--model", type=str, default="pinn", choices=["pinn", "transformer", "rf"], help="Model architecture: pinn (Deep Neural Network), transformer (Fine-Tuned Qwen), or rf (Random Forest)")
    parser.add_argument("--material", type=str, default="PMMA", choices=["PMMA", "Nomex", "Cotton-Fiber Blend"])
    parser.add_argument("--o2", type=float, default=21.0, help="Oxygen concentration %% (e.g. 21.0)")
    parser.add_argument("--flow", type=float, default=7.5, help="Airflow velocity cm/s (e.g. 7.5)")
    parser.add_argument("--pressure", type=float, default=14.7, help="Cabin pressure psi (e.g. 14.7)")
    parser.add_argument("--thickness", type=float, default=2.5, help="Sample thickness mm")
    parser.add_argument("--rag", type=str, help="Search NASA microgravity papers")
    parser.add_argument("--metrics", action="store_true", help="Show honest model validation metrics")
    
    args = parser.parse_args()
    
    if args.demo:
        run_killer_demo(args.model)
    elif args.rag:
        run_rag_search(args.rag)
    elif args.metrics:
        show_metrics()
    else:
        run_prediction(args)

if __name__ == "__main__":
    main()
