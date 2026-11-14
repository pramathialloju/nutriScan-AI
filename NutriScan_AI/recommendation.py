"""
NutriScan AI - Balanced Food Recommendation Engine
Provides balanced, non-restrictive suggestions from actual nutrition data.
"""
from typing import Any, Dict, List


def generate_recommendations(
    foods: List[Dict[str, Any]],
    dietary: str = "all",
    focus: str = "balanced",
    meal_type: str = "all",
) -> List[Dict[str, Any]]:
    candidates = []
    for f in foods:
        if dietary != "all" and f["dietary_type"] != dietary:
            continue
        if meal_type != "all" and meal_type not in f["meal_types"]:
            continue
        candidates.append(f)

    if focus == "indian-cuisine":
        indian_only = [f for f in candidates if f["category"] == "Indian"]
        if indian_only:
            candidates = indian_only
    elif focus == "high-protein":
        prot_only = [f for f in candidates if f["protein_rich"] or f["protein_g"] >= 12]
        if prot_only:
            candidates = prot_only
    elif focus == "weight-management":
        balanced_only = [f for f in candidates if f["balanced_weight_friendly"]]
        if balanced_only:
            candidates = balanced_only

    results = []
    for f in candidates:
        if focus == "high-protein":
            score = f["protein_g"] * 2
            reason = f"Provides {f['protein_g']}g protein per serving."
        elif focus == "indian-cuisine":
            score = (30 if f["category"] == "Indian" else 0) + f["fiber_g"] * 2
            reason = f"Indian meal with {f['protein_g']}g protein and {f['fiber_g']}g fiber."
        elif focus == "weight-management":
            score = f["fiber_g"] * 4 + f["protein_g"] * 1.5 - f["fat_g"] * 0.5
            reason = (
                f"Nutrient-dense option ({f['fiber_g']}g fiber, {f['protein_g']}g protein) "
                "supporting balanced everyday meals."
            )
        else:
            score = f["fiber_g"] * 3 + f["protein_g"]
            reason = f"Balanced mix of carbs ({f['carbs_g']}g), protein ({f['protein_g']}g), and fiber ({f['fiber_g']}g)."

        results.append({"food": f, "score": round(score, 1), "reason": reason})

    results.sort(key=lambda item: item["score"], reverse=True)
    return results
