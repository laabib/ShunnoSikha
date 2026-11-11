#!/usr/bin/env python3
"""
Automated Verification & Test Suite for NASA Microgravity Flammability System
Tests:
1. Master dataset integrity and distribution.
2. FlammabilityPredictor physical boundary consistency (Killer Demo: 21% vs 17% O2).
3. RAG Engine retrieval latency, recall, and citation generation.
4. Full-text chunks index integrity (6,691 chunks verified).
5. Multiphase dataset integrity (FLEX 276 droplet tests, ACME 50 gaseous tests).
6. Multi-model predictor validation (PINN, Transformer, Random Forest).
"""

import unittest
import os
import json
import pandas as pd
from flammability_model import FlammabilityPredictor, MATERIAL_PROPERTIES
from rag.rag_engine import MicrogravityRAGEngine

class TestMicrogravityFlammabilitySystem(unittest.TestCase):
    
    @classmethod
    def setUpClass(cls):
        cls.predictor = FlammabilityPredictor(model_type="pinn")
        cls.rag = MicrogravityRAGEngine()

    def test_01_master_dataset_integrity(self):
        """Verify master dataset exists and has balanced target classes."""
        self.assertTrue(os.path.exists("data/flammability_master_dataset.csv"))
        df = pd.read_csv("data/flammability_master_dataset.csv")
        self.assertGreaterEqual(len(df), 60)
        statuses = df["flammability_status"].value_counts().to_dict()
        self.assertIn("Sustained Burn", statuses)
        self.assertIn("Radiative Extinction", statuses)
        self.assertIn("Blowoff", statuses)
        # Ensure all 3 materials are present
        materials = set(df["sample_material"].unique())
        self.assertTrue({"PMMA", "Nomex", "Cotton-Fiber Blend"}.issubset(materials))

    def test_02_killer_demo_boundary_crossing(self):
        """Verify the Killer Demo physical transition: 21% -> 17% O2 for PMMA."""
        # At 21% O2 and moderate flow, PMMA must be in Sustained Burn
        res_21 = self.predictor.predict("PMMA", 21.0, 7.5, 14.7, 2.5)
        self.assertEqual(res_21["predicted_regime"], "Sustained Burn")
        self.assertGreater(res_21["probabilities"]["Sustained Burn"], 0.50)
        
        # At 17% O2 and moderate flow, PMMA must be in Radiative Extinction
        res_17 = self.predictor.predict("PMMA", 17.0, 7.5, 14.7, 2.5)
        self.assertEqual(res_17["predicted_regime"], "Radiative Extinction")
        self.assertGreater(res_17["probabilities"]["Radiative Extinction"], 0.50)

    def test_03_rag_full_text_chunks_indexing(self):
        """Verify that 6,691+ full-text chunks are indexed with page numbers."""
        self.assertTrue(os.path.exists("rag/nasa_full_text_chunks.jsonl"))
        chunk_docs = [d for d in self.rag.doc_index if d.get("type") == "full_text_chunk"]
        self.assertGreaterEqual(len(chunk_docs), 6000)
        # Verify page number attribute exists
        self.assertIn("page_num", chunk_docs[0])
        self.assertGreater(len(chunk_docs[0]["text"]), 50)

    def test_04_rag_killer_demo_citations(self):
        """Verify that the explanation layer returns seminal NASA report identifiers."""
        explanation = self.rag.explain_boundary_crossing("PMMA", 7.5, 14.7, 21.0, 17.0)
        self.assertEqual(explanation["regime_start"], "Sustained Burn")
        self.assertEqual(explanation["regime_end"], "Radiative Extinction")
        seminal_ids = [r["report_id"] for r in explanation["seminal_reports"]]
        # Ensure BASS concurrent flow paper and blowoff paper are cited
        self.assertTrue(any("20150008961" in s or "TN21414" in s for s in seminal_ids))
        self.assertTrue(any("20160012691" in s or "TN30478" in s for s in seminal_ids))

    def test_05_rag_retrieval_accuracy(self):
        """Verify retrieval for specific combustion phenomena returns relevant reports."""
        results = self.rag.retrieve("cool flame droplet extinction FLEX", top_k=3)
        self.assertGreater(len(results), 0)
        texts = " ".join([r.get("text", "") + " " + r.get("title", "") for r in results]).lower()
        self.assertTrue("droplet" in texts or "cool" in texts or "extinction" in texts)

    def test_06_model_validation_metrics_files(self):
        """Verify model metrics JSON files exist for PINN, Transformer, and Random Forest."""
        self.assertTrue(os.path.exists("rag/model_metrics.json"))
        self.assertTrue(os.path.exists("rag/pinn_model_metrics.json"))
        self.assertTrue(os.path.exists("rag/transformer_model_metrics.json"))
        
        with open("rag/pinn_model_metrics.json") as f:
            pinn_metrics = json.load(f)
        self.assertGreater(pinn_metrics["test_accuracy"], 0.80)
        
        with open("rag/model_metrics.json") as f:
            rf_metrics = json.load(f)
        self.assertEqual(rf_metrics["cross_validation"]["n_splits"], 5)

    def test_07_multiphase_datasets_integrity(self):
        """Verify FLEX liquid droplet (276 runs) and ACME gaseous flame (50 runs) datasets."""
        self.assertTrue(os.path.exists("flex_table_ix_clean.csv"))
        df_flex = pd.read_csv("flex_table_ix_clean.csv")
        self.assertEqual(len(df_flex), 276)
        self.assertIn("D0_mm", df_flex.columns)
        self.assertIn("ext_diameter_mm", df_flex.columns)
        
        self.assertTrue(os.path.exists("ACME_Gaseous_Flames_Dataset.csv"))
        df_acme = pd.read_csv("ACME_Gaseous_Flames_Dataset.csv")
        self.assertEqual(len(df_acme), 50)
        self.assertIn("soot_volume_fraction_ppm", df_acme.columns)
        self.assertIn("peak_flame_temp_K", df_acme.columns)

    def test_08_multi_model_predictors(self):
        """Verify that PINN, Random Forest, and Transformer predictors all produce valid predictions."""
        # 1. PINN
        p_pinn = FlammabilityPredictor(model_type="pinn")
        res_p = p_pinn.predict("PMMA", 21.0, 7.5)
        self.assertIn(res_p["predicted_regime"], ["Sustained Burn", "Radiative Extinction", "Blowoff"])
        
        # 2. Random Forest
        p_rf = FlammabilityPredictor(model_type="rf")
        res_rf = p_rf.predict("PMMA", 21.0, 7.5)
        self.assertIn(res_rf["predicted_regime"], ["Sustained Burn", "Radiative Extinction", "Blowoff"])
        
        # 3. Transformer
        p_trans = FlammabilityPredictor(model_type="transformer")
        res_t = p_trans.predict("PMMA", 21.0, 7.5)
        self.assertIn(res_t["predicted_regime"], ["Sustained Burn", "Radiative Extinction", "Blowoff"])

if __name__ == "__main__":
    unittest.main()
