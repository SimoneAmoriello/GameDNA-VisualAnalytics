import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import GameMap from "./components/GameMap";
import AnalyticsView from "./components/AnalyticsView";
import TagAnalysisView from "./components/TagAnalysisView";
import GameDNAView from "./components/GameDNAView";

import "./App.css";


// -------------------------------------------------------
// Six standardized Game DNA dimensions
// -------------------------------------------------------
const MIN_TAG_GROUP_SIZE = 10;
const GAME_DNA_DIMENSIONS = [
  {
    key: "Popularity_Z",
    label: "Popularity",
  },
  {
    key: "Appreciation_Z",
    label: "Appreciation",
  },
  {
    key: "Engagement_Z",
    label: "Engagement",
  },
  {
    key: "Commercial_Position_Z",
    label: "Commercial Position",
  },
  {
    key: "Maturity_Z",
    label: "Maturity",
  },
  {
    key: "Market_Reach_Z",
    label: "Market Reach",
  },
];


function App() {

  // -------------------------------------------------------
  // Dataset
  // -------------------------------------------------------

  const [games, setGames] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState(null);


  // -------------------------------------------------------
  // Global controls
  // -------------------------------------------------------

  const [
    searchQuery,
    setSearchQuery,
  ] = useState("");

  const [
    selectedGenre,
    setSelectedGenre,
  ] = useState("");


  // -------------------------------------------------------
  // Single game selection
  // -------------------------------------------------------

  const [
    selectedGame,
    setSelectedGame,
  ] = useState(null);


  // -------------------------------------------------------
  // Shared hover between Game Map and Game DNA
  // -------------------------------------------------------

  const [
    hoveredGame,
    setHoveredGame,
  ] = useState(null);


  // -------------------------------------------------------
  // Temporary brush selection on the Game Map
  // -------------------------------------------------------

  const [
    mapSelection,
    setMapSelection,
  ] = useState([]);

  const [
    pendingFocusBounds,
    setPendingFocusBounds,
  ] = useState(null);


  // -------------------------------------------------------
  // Locked PCA market region
  // -------------------------------------------------------

  const [
    marketFocusBounds,
    setMarketFocusBounds,
  ] = useState(null);


  // -------------------------------------------------------
  // Selection produced by Game DNA brushes
  // -------------------------------------------------------

  const [
    dnaSelection,
    setDnaSelection,
  ] = useState([]);

  const [
    dnaBrushActive,
    setDnaBrushActive,
  ] = useState(false);


  // -------------------------------------------------------
  // Signals used to graphically remove D3 brushes
  // -------------------------------------------------------

  const [
    mapBrushResetToken,
    setMapBrushResetToken,
  ] = useState(0);

  const [
    dnaBrushResetToken,
    setDnaBrushResetToken,
  ] = useState(0);


  // -------------------------------------------------------
  // Load dataset
  // -------------------------------------------------------

  useEffect(() => {

    async function loadGames() {

      try {

        const response =
          await fetch(
            "/data/Game_DNA_5000_app.json"
          );


        if (!response.ok) {

          throw new Error(
            "Could not load Game DNA dataset."
          );

        }


        const data =
          await response.json();


        setGames(
          data
        );

      }

      catch (err) {

        setError(
          err.message
        );

      }

      finally {

        setLoading(
          false
        );

      }

    }


    loadGames();

  }, []);


  // -------------------------------------------------------
  // Available genres
  // -------------------------------------------------------

  const genres =
    useMemo(() => {

      const allGenres =
        new Set();


      games.forEach(
        (game) => {

          game.Genres.forEach(
            (genre) => {

              allGenres.add(
                genre
              );

            }
          );

        }
      );


      return Array
        .from(
          allGenres
        )
        .sort();

    }, [
      games,
    ]);


  // -------------------------------------------------------
  // Genre filter
  // -------------------------------------------------------

  const filteredGames =
    useMemo(() => {

      if (
        !selectedGenre
      ) {

        return games;

      }


      return games.filter(
        (game) =>
          game.Genres.includes(
            selectedGenre
          )
      );

    }, [
      games,
      selectedGenre,
    ]);


  // -------------------------------------------------------
  // All games geometrically inside the locked PCA region
  // -------------------------------------------------------
  //
  // This ignores Genre and Search.
  // It represents the complete spatial Market Focus.
  // -------------------------------------------------------

  const marketRegionGames =
    useMemo(() => {

      if (
        !marketFocusBounds
      ) {

        return [];

      }


      return games.filter(
        (game) => {

          return (
            game.PC1 >=
              marketFocusBounds.pc1Min &&

            game.PC1 <=
              marketFocusBounds.pc1Max &&

            game.PC2 >=
              marketFocusBounds.pc2Min &&

            game.PC2 <=
              marketFocusBounds.pc2Max
          );

        }
      );

    }, [
      games,
      marketFocusBounds,
    ]);


  // -------------------------------------------------------
  // Games available inside the Market Focus
  // after applying the Genre filter
  // -------------------------------------------------------

  const focusGames =
    useMemo(() => {

      // Without a Market Focus,
      // the complete genre-filtered dataset is available.
      if (
        !marketFocusBounds
      ) {

        return filteredGames;

      }


      return filteredGames.filter(
        (game) => {

          return (
            game.PC1 >=
              marketFocusBounds.pc1Min &&

            game.PC1 <=
              marketFocusBounds.pc1Max &&

            game.PC2 >=
              marketFocusBounds.pc2Min &&

            game.PC2 <=
              marketFocusBounds.pc2Max
          );

        }
      );

    }, [
      filteredGames,
      marketFocusBounds,
    ]);


  // -------------------------------------------------------
  // Search
  // -------------------------------------------------------

  const searchedGameIds =
    useMemo(() => {

      const query =
        searchQuery
          .trim()
          .toLowerCase();


      if (!query) {

        return new Set();

      }


      return new Set(

        focusGames

          .filter(
            (game) =>
              game.Name
                .toLowerCase()
                .includes(
                  query
                )
          )

          .map(
            (game) =>
              game.AppID
          )

      );

    }, [
      focusGames,
      searchQuery,
    ]);


  const searchActive =
    searchQuery
      .trim()
      .length > 0;


  // -------------------------------------------------------
  // Number displayed in the header
  // -------------------------------------------------------

  const displayedGameCount =
    dnaBrushActive

      ? dnaSelection.length

      : searchActive

        ? searchedGameIds.size

        : focusGames.length;


  // =======================================================
  // STEP 8.1
  // CURRENT ANALYTICAL GROUP
  // =======================================================
  //
  // Priority:
  //
  // 1. Game DNA refinement
  // 2. Locked Market Focus
  // 3. Temporary Game Map brush
  //
  // Search alone does not create an analytical group.
  // =======================================================

  const analyticalSelection =
    useMemo(() => {

      // ---------------------------------------------------
      // 1. DNA refinement
      // ---------------------------------------------------

      if (
        dnaBrushActive
      ) {

        return {

          source:
            "dna",

          label:
            "DNA refinement",

          games:
            dnaSelection,

        };

      }


      // ---------------------------------------------------
      // 2. Locked Market Focus
      // ---------------------------------------------------

      if (
        marketFocusBounds
      ) {

        return {

          source:
            "focus",

          label:
            "Market Focus",

          games:
            focusGames,

        };

      }


      // ---------------------------------------------------
      // 3. Temporary Map selection
      // ---------------------------------------------------

      if (
        mapSelection.length > 0
      ) {

        return {

          source:
            "map",

          label:
            "Map selection",

          games:
            mapSelection,

        };

      }


      // ---------------------------------------------------
      // No analytical selection
      // ---------------------------------------------------

      return {

        source:
          null,

        label:
          null,

        games:
          [],

      };

    }, [
      dnaBrushActive,
      dnaSelection,
      marketFocusBounds,
      focusGames,
      mapSelection,
    ]);


  // =======================================================
  // STEP 8.1
  // GROUP CHARACTERIZATION
  // =======================================================
  //
  // For each standardized Game DNA dimension:
  //
  // Delta =
  // mean(selected group)
  // -
  // mean(rest of the 5,000-game market)
  //
  // Positive Delta:
  // selected group is higher.
  //
  // Negative Delta:
  // selected group is lower.
  // =======================================================

  const groupCharacterization =
    useMemo(() => {

      const selectedGames =
        analyticalSelection.games;


      // No active analytical group.
      if (
        selectedGames.length === 0
      ) {

        return null;

      }


      // ---------------------------------------------------
      // Create a set of selected AppIDs
      // ---------------------------------------------------

      const selectedIds =
        new Set(

          selectedGames.map(
            (game) =>
              game.AppID
          )

        );


      // ---------------------------------------------------
      // Rest of the complete 5,000-game market
      // ---------------------------------------------------

      const restGames =
        games.filter(
          (game) =>
            !selectedIds.has(
              game.AppID
            )
        );


      // Comparison is impossible if all games
      // belong to the selected group.
      if (
        restGames.length === 0
      ) {

        return null;

      }


      // ---------------------------------------------------
      // Compute the six differences between means
      // ---------------------------------------------------

      const dimensions =
        GAME_DNA_DIMENSIONS.map(
          (dimension) => {

            // ---------------------------------------------
            // Mean in selected group
            // ---------------------------------------------

            const selectedMean =

              selectedGames.reduce(
                (
                  sum,
                  game
                ) => {

                  return (
                    sum +
                    Number(
                      game[
                        dimension.key
                      ]
                    )
                  );

                },
                0
              )

              /

              selectedGames.length;


            // ---------------------------------------------
            // Mean in rest of market
            // ---------------------------------------------

            const restMean =

              restGames.reduce(
                (
                  sum,
                  game
                ) => {

                  return (
                    sum +
                    Number(
                      game[
                        dimension.key
                      ]
                    )
                  );

                },
                0
              )

              /

              restGames.length;


            // ---------------------------------------------
            // Difference
            // ---------------------------------------------

            const delta =
              selectedMean -
              restMean;


            return {

              key:
                dimension.key,

              label:
                dimension.label,

              selectedMean,

              restMean,

              delta,

            };

          }
        );


      // ---------------------------------------------------
      // Complete result passed to AnalyticsView
      // ---------------------------------------------------

      return {

        source:
          analyticalSelection.source,

        sourceLabel:
          analyticalSelection.label,

        selectedCount:
          selectedGames.length,

        restCount:
          restGames.length,

        dimensions,

      };

    }, [
      games,
      analyticalSelection,
    ]);


  // =======================================================
  // STEP 8.3
  // GAME SIMILARITY
  // =======================================================
  //
  // Similarity is computed in the complete
  // six-dimensional standardized Game DNA space.
  //
  // The selected game is compared with all other
  // games in the complete 5,000-game dataset.
  //
  // Smaller Euclidean distance = more similar Game DNA.
  // =======================================================

  const gameSimilarity =
    useMemo(() => {

      // No individual game selected.
      if (
        !selectedGame
      ) {

        return null;

      }


      // ---------------------------------------------------
      // Compute distance from the selected game
      // to every other game.
      // ---------------------------------------------------

      const distances =
        games

          .filter(
            (game) =>
              game.AppID !==
              selectedGame.AppID
          )

          .map(
            (game) => {

              const squaredDistance =
                GAME_DNA_DIMENSIONS.reduce(
                  (
                    sum,
                    dimension
                  ) => {

                    const selectedValue =
                      Number(
                        selectedGame[
                          dimension.key
                        ]
                      );


                    const gameValue =
                      Number(
                        game[
                          dimension.key
                        ]
                      );


                    const difference =
                      selectedValue -
                      gameValue;


                    return (
                      sum +
                      difference *
                      difference
                    );

                  },
                  0
                );


              const distance =
                Math.sqrt(
                  squaredDistance
                );


              return {

                game,

                distance,

              };

            }
          );


      // ---------------------------------------------------
      // Smallest distance = most similar
      // ---------------------------------------------------

      distances.sort(
        (a, b) =>
          a.distance -
          b.distance
      );


      // ---------------------------------------------------
      // Keep only the five closest games
      // ---------------------------------------------------

      const similarGames =
        distances.slice(
          0,
          5
        );


      return {

        selectedGame,

        similarGames,

      };

    }, [
      games,
      selectedGame,
    ]);

// =======================================================
// STEP 8.5
// TAG ENRICHMENT
// =======================================================
//
// For each Steam tag:
//
// enrichment =
// prevalence in selected group
// -
// prevalence in rest of market
//
// Positive value:
// tag is more frequent in the selected group.
//
// Negative value:
// tag is less frequent in the selected group.
// =======================================================

  const tagEnrichment =
    useMemo(() => {

      const selectedGames =
        analyticalSelection.games;


      // ---------------------------------------------------
      // No analytical group
      // ---------------------------------------------------

      if (
        selectedGames.length === 0
      ) {

        return null;

      }


      // ---------------------------------------------------
      // Minimum group-size guard
      // ---------------------------------------------------

      if (
        selectedGames.length <
        MIN_TAG_GROUP_SIZE
      ) {

        return {

          status:
            "too-small",

          minimumSize:
            MIN_TAG_GROUP_SIZE,

          source:
            analyticalSelection.source,

          sourceLabel:
            analyticalSelection.label,

          selectedCount:
            selectedGames.length,

          tags:
            [],

        };

      }


      // ---------------------------------------------------
      // Separate selected games from the rest
      // of the complete 5,000-game market
      // ---------------------------------------------------

      const selectedIds =
        new Set(

          selectedGames.map(
            (game) =>
              game.AppID
          )

        );


      const restGames =
        games.filter(
          (game) =>
            !selectedIds.has(
              game.AppID
            )
        );


      if (
        restGames.length === 0
      ) {

        return null;

      }


      // ---------------------------------------------------
      // Count how many GAMES contain each tag
      //
      // We use a Set for every game so that the same
      // tag cannot accidentally be counted twice
      // for one game.
      // ---------------------------------------------------

      function countTags(
        gameList
      ) {

        const counts =
          new Map();


        gameList.forEach(
          (game) => {

            const uniqueTags =
              new Set(
                game.Tags ?? []
              );


            uniqueTags.forEach(
              (tag) => {

                counts.set(
                  tag,
                  (
                    counts.get(tag) ??
                    0
                  ) + 1
                );

              }
            );

          }
        );


        return counts;

      }


      const selectedTagCounts =
        countTags(
          selectedGames
        );


      const restTagCounts =
        countTags(
          restGames
        );


      // ---------------------------------------------------
      // Complete set of tags appearing in either group
      // ---------------------------------------------------

      const allTags =
        new Set([
          ...selectedTagCounts.keys(),
          ...restTagCounts.keys(),
        ]);


      // ---------------------------------------------------
      // Compute prevalence and enrichment
      // ---------------------------------------------------

      const tags =
        Array
          .from(allTags)

          .map(
            (tag) => {

              const selectedCount =
                selectedTagCounts.get(
                  tag
                ) ?? 0;


              const restCount =
                restTagCounts.get(
                  tag
                ) ?? 0;


              const selectedPrevalence =
                selectedCount /
                selectedGames.length;


              const restPrevalence =
                restCount /
                restGames.length;


              const enrichment =
                selectedPrevalence -
                restPrevalence;


              return {

                tag,

                selectedCount,

                restCount,

                selectedPrevalence,

                restPrevalence,

                // Difference as proportion
                enrichment,

                // Easier to display:
                // difference in percentage points
                enrichmentPP:
                  enrichment * 100,

              };

            }
          )

          // Most enriched tags first
          .sort(
            (a, b) =>
              b.enrichmentPP -
              a.enrichmentPP
          );


      return {

        status:
          "ready",

        source:
          analyticalSelection.source,

        sourceLabel:
          analyticalSelection.label,

        selectedCount:
          selectedGames.length,

        restCount:
          restGames.length,

        tags,

      };

    }, [
      games,
      analyticalSelection,
    ]);


  
  // -------------------------------------------------------
  // Shared hover
  // -------------------------------------------------------

  const handleGameHover =
    useCallback(
      (game) => {

        setHoveredGame(
          game
        );

      },
      []
    );


  // -------------------------------------------------------
  // Single game click
  // -------------------------------------------------------

  const handleGameSelect =
    useCallback(
      (game) => {

        // Remove transient hover.
        setHoveredGame(
          null
        );


        // A single click removes an unfinished temporary
        // Game Map brush, but does NOT remove Market Focus
        // or DNA refinement.
        setMapSelection(
          []
        );

        setPendingFocusBounds(
          null
        );


        setMapBrushResetToken(
          (current) =>
            current + 1
        );


        // Clicking the selected game again deselects it.
        setSelectedGame(
          (current) => {

            if (
              current &&
              current.AppID ===
                game.AppID
            ) {

              return null;

            }


            return game;

          }
        );

      },
      []
    );


  // -------------------------------------------------------
  // Temporary Game Map brush
  // -------------------------------------------------------

  const handleMapBrush =
    useCallback(
      (
        group,
        bounds
      ) => {

        setHoveredGame(
          null
        );


        setSelectedGame(
          null
        );


        setMapSelection(
          group
        );


        setPendingFocusBounds(
          bounds
        );

      },
      []
    );


  // -------------------------------------------------------
  // Lock the current Game Map region
  // -------------------------------------------------------

  const handleLockFocus =
    useCallback(
      () => {

        if (
          !pendingFocusBounds ||
          mapSelection.length === 0
        ) {

          return;

        }


        setHoveredGame(
          null
        );


        // -------------------------------------------------
        // Save the PCA boundaries.
        //
        // These boundaries define the Market Focus and
        // are also used by Game Map for automatic zoom.
        // -------------------------------------------------

        setMarketFocusBounds(
          pendingFocusBounds
        );


        // Temporary Map selection is no longer needed.
        setMapSelection(
          []
        );

        setPendingFocusBounds(
          null
        );


        setSelectedGame(
          null
        );


        // -------------------------------------------------
        // A new Market Focus starts without
        // Game DNA refinement.
        // -------------------------------------------------

        setDnaSelection(
          []
        );

        setDnaBrushActive(
          false
        );


        // Remove temporary Map brush graphically.
        setMapBrushResetToken(
          (current) =>
            current + 1
        );


        // Remove possible previous DNA brushes.
        setDnaBrushResetToken(
          (current) =>
            current + 1
        );

      },
      [
        pendingFocusBounds,
        mapSelection.length,
      ]
    );


  // -------------------------------------------------------
  // Clear Market Focus
  // -------------------------------------------------------

  const handleClearFocus =
    useCallback(
      () => {

        setHoveredGame(
          null
        );


        setMarketFocusBounds(
          null
        );


        setMapSelection(
          []
        );

        setPendingFocusBounds(
          null
        );


        setDnaSelection(
          []
        );

        setDnaBrushActive(
          false
        );


        setSelectedGame(
          null
        );


        setMapBrushResetToken(
          (current) =>
            current + 1
        );


        setDnaBrushResetToken(
          (current) =>
            current + 1
        );

      },
      []
    );


  // -------------------------------------------------------
  // Selection created by Game DNA axis brushes
  // -------------------------------------------------------

  const handleDnaSelection =
    useCallback(
      (
        group,
        active
      ) => {

        setHoveredGame(
          null
        );


        setSelectedGame(
          null
        );


        setDnaSelection(
          group
        );


        setDnaBrushActive(
          active
        );

      },
      []
    );


  // -------------------------------------------------------
  // Reset everything
  // -------------------------------------------------------

  function handleReset() {

    setSearchQuery(
      ""
    );

    setSelectedGenre(
      ""
    );


    setHoveredGame(
      null
    );


    setSelectedGame(
      null
    );


    setMapSelection(
      []
    );

    setPendingFocusBounds(
      null
    );


    setMarketFocusBounds(
      null
    );


    setDnaSelection(
      []
    );

    setDnaBrushActive(
      false
    );


    setMapBrushResetToken(
      (current) =>
        current + 1
    );


    setDnaBrushResetToken(
      (current) =>
        current + 1
    );

  }


  // -------------------------------------------------------
  // Search / Genre changes
  // -------------------------------------------------------
  //
  // Market Focus and Game DNA brushes are preserved.
  //
  // Only:
  //
  // - transient hover
  // - temporary Map brush
  // - single-game selection
  //
  // are removed.
  // -------------------------------------------------------

  useEffect(() => {

    setHoveredGame(
      null
    );


    setSelectedGame(
      null
    );


    setMapSelection(
      []
    );

    setPendingFocusBounds(
      null
    );


    setMapBrushResetToken(
      (current) =>
        current + 1
    );

  }, [
    searchQuery,
    selectedGenre,
  ]);


  // -------------------------------------------------------
  // Loading
  // -------------------------------------------------------

  if (
    loading
  ) {

    return (

      <div className="status">

        Loading Game DNA...

      </div>

    );

  }


  // -------------------------------------------------------
  // Error
  // -------------------------------------------------------

  if (
    error
  ) {

    return (

      <div className="status error">

        {error}

      </div>

    );

  }


  // -------------------------------------------------------
  // Interface
  // -------------------------------------------------------

  return (

    <main className="app">

      {/* ===================================================
          HEADER
          =================================================== */}

      <header className="header">

        <div className="brand">

          <h1>
            Game DNA
          </h1>


          <p>
            Visual Analytics for Video Game Market Positioning
          </p>

        </div>


        <div className="header-controls">

          {/* Search */}
          <input
            type="search"

            className="search-input"

            placeholder="Search game..."

            value={
              searchQuery
            }

            onChange={
              (event) =>
                setSearchQuery(
                  event.target.value
                )
            }
          />


          {/* Genre filter */}
          <select
            className="genre-select"

            value={
              selectedGenre
            }

            onChange={
              (event) =>
                setSelectedGenre(
                  event.target.value
                )
            }
          >

            <option value="">
              All genres
            </option>


            {genres.map(
              (genre) => (

                <option
                  value={
                    genre
                  }

                  key={
                    genre
                  }
                >

                  {genre}

                </option>

              )
            )}

          </select>


          {/* Reset */}
          <button
            type="button"

            className="reset-button"

            onClick={
              handleReset
            }
          >

            Reset

          </button>


          {/* Current number of games */}
          <div className="dataset-info">

            {displayedGameCount
              .toLocaleString()}{" "}
            games

          </div>

        </div>

      </header>


      {/* ===================================================
          DASHBOARD
          =================================================== */}

      <div className="dashboard">

        {/* =================================================
            LEFT COLUMN
            GAME MAP + GAME DNA VIEW
            ================================================= */}

        <div className="main-column">

          {/* ===============================================
              GAME MAP
              =============================================== */}

          <GameMap
            games={
              filteredGames
            }

            allGames={
              games
            }


            searchedGameIds={
              searchedGameIds
            }

            searchActive={
              searchActive
            }


            selectedGame={
              selectedGame
            }

            hoveredGame={
              hoveredGame
            }


            mapSelection={
              mapSelection
            }


            marketFocusBounds={
              marketFocusBounds
            }

            marketRegionCount={
              marketRegionGames.length
            }

            focusGameCount={
              focusGames.length
            }


            dnaSelection={
              dnaSelection
            }

            dnaBrushActive={
              dnaBrushActive
            }


            mapBrushResetToken={
              mapBrushResetToken
            }


            onGameSelect={
              handleGameSelect
            }

            onGameHover={
              handleGameHover
            }

            onMapBrush={
              handleMapBrush
            }

            onLockFocus={
              handleLockFocus
            }

            onClearFocus={
              handleClearFocus
            }
          />


          {/* ===============================================
              GAME DNA VIEW
              =============================================== */}

          <GameDNAView
            games={
              focusGames
            }

            allGames={
              games
            }


            searchedGameIds={
              searchedGameIds
            }

            searchActive={
              searchActive
            }


            selectedGame={
              selectedGame
            }

            hoveredGame={
              hoveredGame
            }


            mapSelection={
              mapSelection
            }


            dnaSelection={
              dnaSelection
            }

            dnaBrushActive={
              dnaBrushActive
            }


            marketFocusActive={
              marketFocusBounds !==
              null
            }

            marketRegionCount={
              marketRegionGames.length
            }


            dnaBrushResetToken={
              dnaBrushResetToken
            }


            onDnaSelection={
              handleDnaSelection
            }

            onGameSelect={
              handleGameSelect
            }

            onGameHover={
              handleGameHover
            }
          />

        </div>


        {/* =================================================
            RIGHT COLUMN
            ANALYTICS VIEW + TAG ANALYSIS VIEW
            ================================================= */}

        <div className="side-column">

          <AnalyticsView
            groupCharacterization={
              groupCharacterization
            }

            gameSimilarity={
              gameSimilarity
            }
          />


          <TagAnalysisView
            tagEnrichment={
              tagEnrichment
            }
          />

        </div>

      </div>

    </main>

  );

}


export default App;