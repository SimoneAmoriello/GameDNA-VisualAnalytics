# Game DNA

**Visual Analytics for Video Game Market Positioning**

Game DNA is an interactive Visual Analytics system for exploring the
multidimensional market positioning of PC video games available on Steam.

The system combines dimensionality reduction, coordinated visualizations and
interaction-driven analytics to support the exploration of market segments,
the characterization of groups of games and the discovery of comparable
titles.

---

## Intended User

The intended user is a **game market analyst working for a small or medium-sized
PC game developer or publisher**.

Game DNA supports tasks such as:

- exploring the Steam market;
- identifying groups of games with similar market profiles;
- understanding which characteristics distinguish specific market regions;
- finding comparable products;
- investigating relationships between market positioning and Steam tags;
- discovering comparable games even across different genre categories.

The system is designed for exploratory analysis and is not intended to predict
the commercial success of a game.

---

## Dataset

The project uses the **FronkonGames Steam Games Dataset**:

https://huggingface.co/datasets/FronkonGames/steam-games-dataset

The original dataset contains **125,855 Steam entries**.

A preprocessing pipeline removes unsuitable or insufficient records and
produces a candidate pool of **18,170 games**.

A proportional stratified random sample based on popularity tier and release
era is then used to obtain the final dataset of:

**5,000 games**

The analytical representation contains six dimensions, giving an
Angelini-Santucci index of:

```text
AS = 5000 × 6 = 30,000