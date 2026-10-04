"""
Generate the four Chapter 5 figures (black-and-white, 300 dpi).

Run in VS Code:
    pip install matplotlib numpy
    python generate_chapter5_figures.py

The PNG files are saved in a folder called "figures" next to this script.
Values come from run_acquisition_ablation.py, run_corrected_inference.py
and pcos_model_comparison (reproduced 25 September 2026).
"""
import os
import numpy as np
import matplotlib.pyplot as plt

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "figures")
os.makedirs(OUT, exist_ok=True)

plt.rcParams.update({
    "font.family": "serif",
    "font.serif": ["Times New Roman", "DejaVu Serif"],
    "font.size": 11,
})
DPI = 300


def save(fig, name):
    fig.tight_layout()
    path = os.path.join(OUT, name)
    fig.savefig(path, dpi=DPI)
    plt.close(fig)
    print("Saved", path)


# ---------------------------------------------------------------------------
# Fig. 5.1  Mean AUC by acquisition tier with 95% confidence intervals
# ---------------------------------------------------------------------------
tiers = ["T1\nSelf-reportable\n(13)", "T2\n+ Home\n(20)",
         "T3\n+ Laboratory\n(32)", "T4\n+ Ultrasound\n(37)"]
auc = np.array([88.2, 87.5, 86.5, 94.3])
ci_low = np.array([86.5, 85.9, 84.6, 93.3])
ci_high = np.array([89.8, 89.2, 88.3, 95.4])

fig, ax = plt.subplots(figsize=(6.5, 4))
bars = ax.bar(tiers, auc, yerr=[auc - ci_low, ci_high - auc], capsize=6,
              color=["#404040", "#a0a0a0", "#a0a0a0", "#707070"],
              edgecolor="black", linewidth=0.6)
for bar, value, top in zip(bars, auc, ci_high):
    ax.text(bar.get_x() + bar.get_width() / 2, top + 0.5, f"{value:.1f}", ha="center")
ax.set_ylim(80, 100)
ax.set_ylabel("AUC (%)")
ax.set_xlabel("Acquisition tier (number of features)")
ax.spines[["top", "right"]].set_visible(False)
save(fig, "Fig5_1_AUC_by_tier.png")

# ---------------------------------------------------------------------------
# Fig. 5.2  Corrected tier differences (forest plot)
# ---------------------------------------------------------------------------
labels = ["T1 → T2 (home)", "T2 → T3 (laboratory)",
          "T3 → T4 (ultrasound)", "T1 → T4 (full clinical)"]
delta = [-0.63, -1.06, 7.88, 6.19]
low = [-1.43, -2.83, 3.97, 2.58]
high = [0.17, 0.71, 11.79, 9.79]
pvals = ["p = 0.120", "p = 0.233", "p = 0.0002", "p = 0.0012"]

fig, ax = plt.subplots(figsize=(6.5, 3.2))
y = np.arange(len(labels))[::-1]
for yi, d, lo, hi, p in zip(y, delta, low, high, pvals):
    significant = lo > 0 or hi < 0
    ax.plot([lo, hi], [yi, yi], color="black", lw=1.2)
    ax.plot(d, yi, "s" if significant else "o",
            color="black" if significant else "white",
            markeredgecolor="black", ms=8)
    ax.text(12.8, yi, p, va="center")
ax.axvline(0, color="grey", ls="--", lw=1)
ax.set_yticks(y)
ax.set_yticklabels(labels)
ax.set_xlim(-4, 15)
ax.set_xlabel("Mean ΔAUC (percentage points) with corrected 95% CI")
ax.spines[["top", "right"]].set_visible(False)
save(fig, "Fig5_2_Corrected_tier_differences.png")

# ---------------------------------------------------------------------------
# Fig. 5.3  Mean AUC by tier and classifier
# ---------------------------------------------------------------------------
lr = [88.2, 87.5, 86.5, 94.3]
rf = [88.8, 89.0, 88.5, 95.5]
svm = [88.6, 87.6, 87.2, 94.3]
x = np.arange(4)
w = 0.26

fig, ax = plt.subplots(figsize=(6.5, 4))
for k, (vals, name, colour, hatch) in enumerate([
        (lr, "Logistic regression", "#303030", ""),
        (rf, "Random forest", "#909090", ""),
        (svm, "SVM", "white", "///")]):
    ax.bar(x + (k - 1) * w, vals, w, label=name, color=colour,
           hatch=hatch, edgecolor="black", linewidth=0.5)
ax.set_xticks(x)
ax.set_xticklabels(["T1", "T2", "T3", "T4"])
ax.set_ylim(80, 100)
ax.set_ylabel("Mean AUC (%)")
ax.set_xlabel("Acquisition tier")
ax.legend(frameon=False, loc="upper left")
ax.spines[["top", "right"]].set_visible(False)
save(fig, "Fig5_3_AUC_by_classifier.png")

# ---------------------------------------------------------------------------
# Fig. 5.4  Confusion matrix of the deployed model (hold-out set, 108 records)
# ---------------------------------------------------------------------------
cm = np.array([[58, 15],   # actual Non-PCOS: TN, FP
               [6, 29]])   # actual PCOS:     FN, TP

fig, ax = plt.subplots(figsize=(4, 3.6))
ax.imshow(cm, cmap="Greys", vmin=0, vmax=80)
for i in range(2):
    for j in range(2):
        ax.text(j, i, cm[i, j], ha="center", va="center", fontsize=14,
                color="white" if cm[i, j] > 40 else "black")
ax.set_xticks([0, 1])
ax.set_yticks([0, 1])
ax.set_xticklabels(["Non-PCOS", "PCOS"])
ax.set_yticklabels(["Non-PCOS", "PCOS"])
ax.set_xlabel("Predicted")
ax.set_ylabel("Actual")
save(fig, "Fig5_4_Confusion_matrix.png")

print("Done.")