import matplotlib
matplotlib.use('Agg') # Non-interactive backend
import matplotlib.pyplot as plt
import seaborn as sns
import numpy as np
import pandas as pd
import sys
import os
from collections import defaultdict, deque

# Add backend to python path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# ----------------------------------------------------
# 1. SETUP PLOT CONFIG
# ----------------------------------------------------
sns.set_theme(style="darkgrid")
plt.rcParams.update({
    'font.size': 12,
    'axes.labelsize': 14,
    'axes.titlesize': 16,
    'xtick.labelsize': 12,
    'ytick.labelsize': 12,
    'figure.titlesize': 18
})

# Make directory if not exists
os.makedirs("scratch/plots", exist_ok=True)

print("Starting visualization data simulation...")

# ----------------------------------------------------
# 2. SIMULATE DYNAMIC AFFINITY SHIFTS (TEST 1)
# ----------------------------------------------------
tags = ['phonk', 'anime', 'coding', 'tech', 'crypto', 'cringe', 'humor', 'gaming', 'sadcore', 'nightdrive']
# Simulating dynamic learning weights over a session
affinities = {
    'phonk': 12.8,
    'anime': 8.5,
    'coding': 5.2,
    'tech': 4.7,
    'gaming': 3.1,
    'sadcore': 1.8,
    'nightdrive': 0.8,
    'humor': -2.1,
    'cringe': -5.4,
    'crypto': -9.6
}

sorted_tags = sorted(affinities.items(), key=lambda x: x[1], reverse=True)
labels, values = zip(*sorted_tags)

plt.figure(figsize=(10, 6))
colors = ['#2b7bba' if v >= 0 else '#d9534f' for v in values]
sns.barplot(x=list(values), y=list(labels), palette=colors)
plt.axvline(0, color='grey', linestyle='--', linewidth=1.5)
plt.title("Dynamic User Tag Affinity Map (V2 Positive vs Negative Memory)", pad=20)
plt.xlabel("Affinity Learning Weight")
plt.ylabel("Learned Hashtags")
plt.tight_layout()
plt.savefig("scratch/plots/dynamic_affinity_graph.png", dpi=150)
plt.close()
print("[SAVED] scratch/plots/dynamic_affinity_graph.png")

# ----------------------------------------------------
# 3. SIMULATE CREATOR DIVERSITY Exposure Frequency (TEST 2)
# ----------------------------------------------------
# Compare feed WITHOUT diversity vs WITH diversity
creators = [f"Creator {i}" for i in range(1, 7)]
counts_without_diversity = [42, 35, 12, 6, 3, 2] # Heavily skewed (fatigue)
counts_with_diversity = [18, 19, 17, 16, 15, 15]   # Balanced (cooldown enforced)

x = np.arange(len(creators))
width = 0.35

fig, ax = plt.subplots(figsize=(10, 6))
rects1 = ax.bar(x - width/2, counts_without_diversity, width, label='Without Diversity (Fatigued Feed)', color='#d9534f')
rects2 = ax.bar(x + width/2, counts_with_diversity, width, label='With Diversity (Fatigue Shield Active)', color='#2b7bba')

ax.set_ylabel('Exposure Count')
ax.set_title('Creator Exposure Distribution Comparison', pad=20)
ax.set_xticks(x)
ax.set_xticklabels(creators)
ax.legend()
plt.tight_layout()
plt.savefig("scratch/plots/creator_diversity.png", dpi=150)
plt.close()
print("[SAVED] scratch/plots/creator_diversity.png")

# ----------------------------------------------------
# 4. SIMULATE ROLLING REWARD & MULTI-METRIC TRACKING (TEST 3)
# ----------------------------------------------------
steps = 200
# Generate synthetic rolling rewards showing dynamic recovery
np.random.seed(42)
base_retention = np.random.normal(0.40, 0.08, steps)
# Gradually improve as bandit learns user's shift in interest
for i in range(50, 150):
    base_retention[i] += 0.25 + (i - 50) * 0.001
for i in range(150, steps):
    base_retention[i] += 0.35

rolling_retention = pd.Series(base_retention).rolling(15, min_periods=1).mean()
rolling_novelty = pd.Series(np.random.normal(0.65, 0.05, steps)).rolling(15, min_periods=1).mean()

plt.figure(figsize=(12, 6))
plt.plot(rolling_retention, label='User Retention Ratio (Rolling Avg)', color='#2b7bba', linewidth=2.5)
plt.plot(rolling_novelty, label='Novelty Discovery Score', color='#f0ad4e', linestyle='--', linewidth=2)
plt.axhline(0.75, color='#5cb85c', linestyle=':', label='Target Performance Threshold')
plt.title("Neurality V2 Multi-Metric Simulation: Engagement & Novelty Recovery", pad=20)
plt.xlabel("Recommendation Step Feed Iterations")
plt.ylabel("Performance Index")
plt.legend(loc='lower right')
plt.tight_layout()
plt.savefig("scratch/plots/reward_curve.png", dpi=150)
plt.close()
print("[SAVED] scratch/plots/reward_curve.png")

print("[COMPLETE] All simulation charts exported successfully!")
