# Buffett Quality Pool

**Project:** 槓桿獵人 / 折價獵人候選池  
**Scope:** Binance tokenized universe only  
**Status:** Candidate Pool / Not Buy List  
**Owner:** Josh  
**Project Owner:** ChatGPT / Josh OS Project Owner  
**Updated:** 2026-07-06

---

## 1. Purpose

巴菲特品質池不是新的買入名單。

它的用途是：

```text
在 Binance 股票代幣名單內，篩出健康、有量、品質高的穩健候選。
```

它可以輔助：

1. 槓桿獵人候選篩選。
2. 折價獵人未來候選觀察。
3. Quality Checklist 初始資料整理。
4. 避免只看漲幅榜而忽略企業品質。

---

## 2. Core Difference

### 槓桿獵人

```text
健康 + 高價 + 活潑 + 有量
```

### 巴菲特品質池

```text
健康 + 有量 + 品質高 + 長期競爭力
```

所以巴菲特品質池不一定適合槓桿 / 波段。

品質很好但股性太穩，例如 KO，適合觀察，不適合當槓桿主力。

---

## 3. Candidate Classification

### P1 — 可進槓桿獵人候選觀察

| Token | 中文名稱 | 理由 | 狀態 |
|---|---|---|---|
| AAPLon | 蘋果 | 品質高、有量、高價，但成長動能需確認 | P1 候選 |
| AXPon | 美國運通 | 品質高、金融消費龍頭、股價高 | P1 候選 |
| GOOGLon | Alphabet | 品質高、有量，AI / 廣告 / 雲端平台 | P1 候選 |
| AMZNon | 亞馬遜 | 品質高、有量，雲端與消費平台 | P1 候選 |

### P2 — 品質觀察，不優先槓桿

| Token | 中文名稱 | 理由 | 狀態 |
|---|---|---|---|
| BACon | 美國銀行 | 有量，但銀行週期與利率敏感 | P2 觀察 |
| MAon | 萬事達卡 | 品質高，但是否為目前核心持倉需確認 | P2 觀察 |
| Von | Visa | 品質高，但股性偏穩 | P2 觀察 |
| UNHon | 聯合健康 | 品質型，但政策與醫療風險需確認 | P2 觀察 |
| CVXon | 雪佛龍 | 能源龍頭，週期與油價敏感 | P2 觀察 |
| OXYon | 西方石油 | 巴菲特相關度高，但能源週期與負債需看 | P2 觀察 |

### P3 — 穩健觀察，不進槓桿主名單

| Token | 中文名稱 | 理由 | 狀態 |
|---|---|---|---|
| KOon | 可口可樂 | 品質高、防守強，但股性通常不夠活潑 | P3 穩健觀察 |

---

## 4. Rules

巴菲特品質池不得直接觸發買入。

進槓桿獵人前還要通過：

```text
健康
股價高
股性活潑
有量
代幣流動性
風險上限
```

進折價獵人前還要通過：

```text
Investment Thesis
Quality Checklist
折扣規則
Position Limit
預算檢查
```

---

## 5. Project Owner Decision

加入巴菲特品質池，但不把它當成主策略。

App 顯示方式：

```text
巴菲特品質池
P1：可進槓桿候選
P2：品質觀察
P3：穩健觀察，不進槓桿主名單
```

下一步：

1. 在 `/leveraged-hunter` 加入巴菲特品質池區塊。
2. 不開買點。
3. 後續和 Quality Checklist 接軌。
