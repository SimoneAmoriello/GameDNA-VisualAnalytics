import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import * as d3 from "d3";


const DISPLAY_GENRES = [
  "Action",
  "Adventure",
  "Casual",
  "Simulation",
  "RPG",
  "Strategy",
  "Other",
];


const DIMENSIONS = [
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


function GameDNAView({
  games,
  allGames,
  searchedGameIds,
  searchActive,
  selectedGame,
  hoveredGame,
  mapSelection,
  dnaSelection,
  dnaBrushActive,
  marketFocusActive,
  marketRegionCount,
  dnaBrushResetToken,
  onDnaSelection,
  onGameSelect,
  onGameHover,
}) {

  const width = 1100;
  const height = 260;

  const margin = {
    top: 45,
    right: 50,
    bottom: 20,
    left: 50,
  };


  const svgRef =
    useRef(null);

  const gameDnaContainerRef =
    useRef(null);


  const brushRefs =
    useRef({});

  const brushBehaviorsRef =
    useRef({});


  const activeBrushesRef =
    useRef(new Map());


  const suppressBrushEventsRef =
    useRef(false);


  // Game currently hovered in the Parallel Coordinates
  const [lineTooltip, setLineTooltip] =
    useState(null);


  // -------------------------------------------------------
  // Useful ID sets
  // -------------------------------------------------------

  const mapSelectionIds =
    useMemo(() => {

      return new Set(
        mapSelection.map(
          (game) =>
            game.AppID
        )
      );

    }, [mapSelection]);


  const dnaSelectionIds =
    useMemo(() => {

      return new Set(
        dnaSelection.map(
          (game) =>
            game.AppID
        )
      );

    }, [dnaSelection]);


  const visibleGameIds =
    useMemo(() => {

      return new Set(
        games.map(
          (game) =>
            game.AppID
        )
      );

    }, [games]);


  // -------------------------------------------------------
  // Games available for DNA refinement
  // -------------------------------------------------------

  const candidateGames =
    useMemo(() => {

      if (!searchActive) {

        return games;

      }


      return games.filter(
        (game) =>
          searchedGameIds.has(
            game.AppID
          )
      );

    }, [
      games,
      searchActive,
      searchedGameIds,
    ]);


  // -------------------------------------------------------
  // Horizontal scale
  // -------------------------------------------------------

  const xScale =
    useMemo(() => {

      return d3
        .scalePoint()
        .domain(
          DIMENSIONS.map(
            (dimension) =>
              dimension.key
          )
        )
        .range([
          margin.left,
          width - margin.right,
        ])
        .padding(0.25);

    }, []);


  // -------------------------------------------------------
  // Vertical scale
  // -------------------------------------------------------

  const yScale =
    useMemo(() => {

      const values =
        allGames.flatMap(
          (game) =>
            DIMENSIONS.map(
              (dimension) =>
                game[
                  dimension.key
                ]
            )
        );


      const maxAbsoluteValue =
        d3.max(
          values,
          (value) =>
            Math.abs(value)
        ) || 1;


      return d3
        .scaleLinear()
        .domain([
          -maxAbsoluteValue,
          maxAbsoluteValue,
        ])
        .nice()
        .range([
          height - margin.bottom,
          margin.top,
        ]);

    }, [allGames]);


  // -------------------------------------------------------
  // Genre colors
  // -------------------------------------------------------

  const colorScale =
    useMemo(() => {

      return d3
        .scaleOrdinal()
        .domain(
          DISPLAY_GENRES
        )
        .range(
          d3.schemeTableau10.slice(
            0,
            DISPLAY_GENRES.length
          )
        );

    }, []);


  // -------------------------------------------------------
  // Parallel line generator
  // -------------------------------------------------------

  const lineGenerator =
    useMemo(() => {

      return d3
        .line()
        .x(
          (point) =>
            xScale(
              point.dimension
            )
        )
        .y(
          (point) =>
            yScale(
              point.value
            )
        );

    }, [
      xScale,
      yScale,
    ]);


  // -------------------------------------------------------
  // Convert one game into the six Parallel Coordinate points
  // -------------------------------------------------------

  function getGamePoints(game) {

    return DIMENSIONS.map(
      (dimension) => ({

        dimension:
          dimension.key,

        value:
          game[
            dimension.key
          ],

      })
    );

  }


  // -------------------------------------------------------
  // Recalculate DNA selection
  // -------------------------------------------------------

  const recalculateDnaSelection =
    useCallback(() => {

      const activeBrushes =
        activeBrushesRef.current;


      if (
        activeBrushes.size === 0
      ) {

        onDnaSelection(
          [],
          false
        );

        return;

      }


      const selectedGames =
        candidateGames.filter(
          (game) => {

            return Array
              .from(
                activeBrushes.entries()
              )
              .every(
                ([
                  dimensionKey,
                  range,
                ]) => {

                  const [
                    minValue,
                    maxValue,
                  ] = range;


                  const value =
                    game[
                      dimensionKey
                    ];


                  return (
                    value >=
                      minValue &&
                    value <=
                      maxValue
                  );

                }
              );

          }
        );


      onDnaSelection(
        selectedGames,
        true
      );

    }, [
      candidateGames,
      onDnaSelection,
    ]);


  // -------------------------------------------------------
  // Drawing order
  // -------------------------------------------------------

  const orderedGames =
    useMemo(() => {

      function getPriority(game) {

        if (
          selectedGame?.AppID ===
          game.AppID
        ) {

          return 4;

        }


        if (
          dnaSelectionIds.has(
            game.AppID
          )
        ) {

          return 3;

        }


        if (
          mapSelectionIds.has(
            game.AppID
          )
        ) {

          return 2;

        }


        if (
          searchActive &&
          searchedGameIds.has(
            game.AppID
          )
        ) {

          return 1;

        }


        return 0;

      }


      return [...games].sort(
        (gameA, gameB) =>
          getPriority(gameA) -
          getPriority(gameB)
      );

    }, [
      games,
      selectedGame,
      dnaSelectionIds,
      mapSelectionIds,
      searchActive,
      searchedGameIds,
    ]);


  // -------------------------------------------------------
  // Which lines can be hovered / clicked?
  // -------------------------------------------------------

  function isLineInteractive(game) {

    // After DNA refinement:
    // only surviving games are interactive.
    if (dnaBrushActive) {

      return dnaSelectionIds.has(
        game.AppID
      );

    }


    // Inside a locked Market Focus:
    // all current focus games are interactive,
    // unless Search is active.
    if (marketFocusActive) {

      if (searchActive) {

        return searchedGameIds.has(
          game.AppID
        );

      }


      return true;

    }


    // Before locking a Market Focus,
    // games temporarily selected on the Map
    // can already be inspected.
    if (
      mapSelection.length > 0
    ) {

      return mapSelectionIds.has(
        game.AppID
      );

    }


    // Search results can also be inspected.
    if (searchActive) {

      return searchedGameIds.has(
        game.AppID
      );

    }


    // Do not make all 5,000 lines interactive.
    return false;

  }


  // -------------------------------------------------------
  // Create the six vertical axes
  // -------------------------------------------------------

  useEffect(() => {

    const svg =
      d3.select(
        svgRef.current
      );


    DIMENSIONS.forEach(
      (dimension) => {

        const axis =
          d3
            .axisLeft(
              yScale
            )
            .ticks(5)
            .tickFormat(
              d3.format(".1f")
            );


        svg
          .select(
            `[data-axis="${dimension.key}"]`
          )
          .call(axis);

      }
    );

  }, [yScale]);


  // -------------------------------------------------------
  // Create one vertical brush for every DNA dimension
  // -------------------------------------------------------

  useEffect(() => {

    if (!marketFocusActive) {

      activeBrushesRef
        .current
        .clear();


      brushBehaviorsRef.current =
        {};


      DIMENSIONS.forEach(
        (dimension) => {

          const node =
            brushRefs.current[
              dimension.key
            ];


          if (node) {

            d3
              .select(node)
              .on(
                ".brush",
                null
              )
              .selectAll("*")
              .remove();

          }

        }
      );


      return;

    }


    DIMENSIONS.forEach(
      (dimension) => {

        const node =
          brushRefs.current[
            dimension.key
          ];


        if (!node) {

          return;

        }


        const brush =
          d3
            .brushY()
            .extent([
              [
                -14,
                margin.top,
              ],
              [
                14,
                height -
                  margin.bottom,
              ],
            ])
            .on(
              "end",
              (event) => {

                if (
                  suppressBrushEventsRef
                    .current
                ) {

                  return;

                }


                const selection =
                  event.selection;


                if (!selection) {

                  activeBrushesRef
                    .current
                    .delete(
                      dimension.key
                    );

                }

                else {

                  const [
                    y0,
                    y1,
                  ] = selection;


                  const valueA =
                    yScale.invert(
                      y1
                    );

                  const valueB =
                    yScale.invert(
                      y0
                    );


                  const minValue =
                    Math.min(
                      valueA,
                      valueB
                    );


                  const maxValue =
                    Math.max(
                      valueA,
                      valueB
                    );


                  activeBrushesRef
                    .current
                    .set(
                      dimension.key,
                      [
                        minValue,
                        maxValue,
                      ]
                    );

                }


                recalculateDnaSelection();

              }
            );


        brushBehaviorsRef.current[
          dimension.key
        ] = brush;


        const brushGroup =
          d3.select(
            node
          );


        brushGroup.call(
          brush
        );


        // Preserve existing brushes after
        // Search / Genre changes.
        const existingRange =
          activeBrushesRef
            .current
            .get(
              dimension.key
            );


        if (existingRange) {

          const [
            minValue,
            maxValue,
          ] = existingRange;


          suppressBrushEventsRef
            .current = true;


          brushGroup.call(
            brush.move,
            [
              yScale(maxValue),
              yScale(minValue),
            ]
          );


          suppressBrushEventsRef
            .current = false;

        }

      }
    );


    return () => {

      DIMENSIONS.forEach(
        (dimension) => {

          const node =
            brushRefs.current[
              dimension.key
            ];


          if (node) {

            d3
              .select(node)
              .on(
                ".brush",
                null
              );

          }

        }
      );

    };

  }, [
    marketFocusActive,
    yScale,
    recalculateDnaSelection,
  ]);


  // -------------------------------------------------------
  // Recalculate after Search / Genre changes
  // -------------------------------------------------------

  useEffect(() => {

    if (
      !marketFocusActive ||
      activeBrushesRef
        .current
        .size === 0
    ) {

      return;

    }


    recalculateDnaSelection();

  }, [
    candidateGames,
    marketFocusActive,
    recalculateDnaSelection,
  ]);


  // -------------------------------------------------------
  // Clear all DNA brushes after Reset / Clear Focus
  // -------------------------------------------------------

  useEffect(() => {

    suppressBrushEventsRef
      .current = true;


    activeBrushesRef
      .current
      .clear();


    DIMENSIONS.forEach(
      (dimension) => {

        const node =
          brushRefs.current[
            dimension.key
          ];


        const brush =
          brushBehaviorsRef.current[
            dimension.key
          ];


        if (
          node &&
          brush
        ) {

          d3
            .select(node)
            .call(
              brush.move,
              null
            );

        }

      }
    );


    suppressBrushEventsRef
      .current = false;


    setLineTooltip(
      null
    );

  }, [
    dnaBrushResetToken,
  ]);


  // -------------------------------------------------------
  // Remove tooltip if the current context changes
  // -------------------------------------------------------

  useEffect(() => {

    setLineTooltip(
      null
    );

  }, [
    marketFocusActive,
    dnaBrushActive,
    searchActive,
    games,
  ]);


  // -------------------------------------------------------
  // Interface
  // -------------------------------------------------------

  return (
    <section className="panel game-dna-view">

      <div className="panel-header">

        <div>

          <h2>
            Game DNA View
          </h2>


          <p className="panel-description">
            Parallel Coordinates over the six standardized Game DNA dimensions
          </p>

        </div>

      </div>


      <div
        className="game-dna-content"
        ref={
          gameDnaContainerRef
        }
      >

        <svg
          ref={
            svgRef
          }

          viewBox={
            `0 0 ${width} ${height}`
          }

          className="game-dna-svg"
        >

          {/* ---------------------------------------------
              Base game profiles
              --------------------------------------------- */}

          <g className="parallel-lines">

            {orderedGames.map(
              (game) => {

                const clicked =
                  selectedGame?.AppID ===
                  game.AppID;


                const mapSelected =
                  mapSelectionIds.has(
                    game.AppID
                  );


                const dnaSelected =
                  dnaSelectionIds.has(
                    game.AppID
                  );


                const searched =
                  searchedGameIds.has(
                    game.AppID
                  );


                let stroke =
                  "#777";

                let strokeWidth =
                  0.7;

                let opacity =
                  marketFocusActive
                    ? 0.12
                    : 0.08;


                // Single clicked game
                if (clicked) {

                  stroke =
                    colorScale(
                      game.DisplayGenre
                    );

                  strokeWidth =
                    2.6;

                  opacity =
                    1;

                }


                // DNA refinement
                else if (
                  dnaBrushActive
                ) {

                  if (dnaSelected) {

                    stroke =
                      colorScale(
                        game.DisplayGenre
                      );

                    strokeWidth =
                      1.2;

                    opacity =
                      0.85;

                  }

                  else {

                    stroke =
                      "#999";

                    strokeWidth =
                      0.5;

                    opacity =
                      0.015;

                  }

                }


                // Temporary Game Map selection
                else if (
                  mapSelection.length > 0
                ) {

                  if (mapSelected) {

                    stroke =
                      colorScale(
                        game.DisplayGenre
                      );

                    strokeWidth =
                      1.1;

                    opacity =
                      0.8;

                  }

                  else {

                    stroke =
                      "#999";

                    strokeWidth =
                      0.5;

                    opacity =
                      0.015;

                  }

                }


                // Search
                else if (
                  searchActive
                ) {

                  if (searched) {

                    stroke =
                      colorScale(
                        game.DisplayGenre
                      );

                    strokeWidth =
                      1;

                    opacity =
                      0.75;

                  }

                  else {

                    stroke =
                      "#999";

                    strokeWidth =
                      0.5;

                    opacity =
                      0.015;

                  }

                }


                return (

                  <path
                    key={
                      game.AppID
                    }

                    d={
                      lineGenerator(
                        getGamePoints(
                          game
                        )
                      )
                    }

                    className="parallel-line"

                    stroke={
                      stroke
                    }

                    strokeWidth={
                      strokeWidth
                    }

                    opacity={
                      opacity
                    }
                  />

                );

              }
            )}

          </g>


          {/* ---------------------------------------------
              Selected game highlight
              Black outline + genre color
              --------------------------------------------- */}

          {selectedGame &&
            visibleGameIds.has(
              selectedGame.AppID
            ) && (

            <g
              className="selected-profile-highlight"
              pointerEvents="none"
            >

              {/* Black outer line */}
              <path
                d={
                  lineGenerator(
                    getGamePoints(
                      selectedGame
                    )
                  )
                }

                fill="none"
                stroke="#111"
                strokeWidth={5}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={1}
              />


              {/* Colored inner line */}
              <path
                d={
                  lineGenerator(
                    getGamePoints(
                      selectedGame
                    )
                  )
                }

                fill="none"

                stroke={
                  colorScale(
                    selectedGame.DisplayGenre
                  )
                }

                strokeWidth={2.6}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={1}
              />

            </g>

          )}


          {/* ---------------------------------------------
              Hovered game highlight
              --------------------------------------------- */}

          {hoveredGame &&
            visibleGameIds.has(
              hoveredGame.AppID
            ) &&
            hoveredGame.AppID !==
              selectedGame?.AppID && (

            <g
              className="hovered-profile-highlight"
              pointerEvents="none"
            >

              <path
                d={
                  lineGenerator(
                    getGamePoints(
                      hoveredGame
                    )
                  )
                }

                fill="none"
                stroke="#333"
                strokeWidth={4}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.9}
              />


              <path
                d={
                  lineGenerator(
                    getGamePoints(
                      hoveredGame
                    )
                  )
                }

                fill="none"

                stroke={
                  colorScale(
                    hoveredGame.DisplayGenre
                  )
                }

                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={1}
              />

            </g>

          )}


          {/* ---------------------------------------------
              Invisible interaction layer
              --------------------------------------------- */}

          <g className="parallel-interaction-layer">

            {orderedGames.map(
              (game) => {

                if (
                  !isLineInteractive(
                    game
                  )
                ) {

                  return null;

                }


                return (

                  <path
                    key={
                      `interaction-${game.AppID}`
                    }

                    d={
                      lineGenerator(
                        getGamePoints(
                          game
                        )
                      )
                    }

                    className="parallel-hit-line"

                    fill="none"
                    stroke="transparent"
                    strokeWidth={8}

                    pointerEvents="stroke"


                    onMouseEnter={
                      (event) => {

                        const bounds =
                          gameDnaContainerRef
                            .current
                            .getBoundingClientRect();


                        setLineTooltip({

                          game,

                          x:
                            event.clientX -
                            bounds.left,

                          y:
                            event.clientY -
                            bounds.top,

                          containerWidth:
                            bounds.width,

                        });


                        onGameHover(
                          game
                        );

                      }
                    }


                    onMouseLeave={() => {

                      setLineTooltip(null);
                      onGameHover(null);

                    }}


                    onClick={
                      (event) => {

                        event
                          .stopPropagation();


                        onGameSelect(
                          game
                        );

                      }
                    }
                  />

                );

              }
            )}

          </g>


          {/* Z = 0 reference line */}
          <line
            x1={
              margin.left
            }

            x2={
              width -
              margin.right
            }

            y1={
              yScale(0)
            }

            y2={
              yScale(0)
            }

            className="zero-line"
          />


          {/* ---------------------------------------------
              Six axes
              --------------------------------------------- */}

          {DIMENSIONS.map(
            (dimension) => (

              <g
                key={
                  dimension.key
                }

                transform={
                  `translate(${xScale(
                    dimension.key
                  )}, 0)`
                }
              >

                <g
                  data-axis={
                    dimension.key
                  }

                  className="parallel-axis"
                />


                <g
                  ref={
                    (node) => {

                      if (node) {

                        brushRefs.current[
                          dimension.key
                        ] = node;

                      }

                    }
                  }

                  className={
                    marketFocusActive
                      ? "parallel-brush"
                      : "parallel-brush disabled"
                  }
                />


                <text
                  x={0}
                  y={25}

                  textAnchor="middle"

                  className="parallel-axis-label"
                >

                  {dimension.label}

                </text>

              </g>

            )
          )}

        </svg>


        {/* ---------------------------------------------
            Line tooltip
            --------------------------------------------- */}

        {lineTooltip && (

          <div
            className="dna-tooltip"

            style={{

              left:
                lineTooltip.x >
                lineTooltip.containerWidth -
                  240

                  ? lineTooltip.x -
                    222

                  : lineTooltip.x +
                    12,


              top:
                lineTooltip.y +
                12,

            }}
          >

            <div className="dna-tooltip-title">

              {lineTooltip.game.Name}

            </div>


            <div className="dna-tooltip-genre">

              {lineTooltip.game.DisplayGenre}

            </div>


            <div className="dna-tooltip-hint">

              Click to select

            </div>

          </div>

        )}

      </div>


      {/* ---------------------------------------------
          Status
          --------------------------------------------- */}

      <div className="game-dna-status">

        {selectedGame

          ? `Selected game: ${selectedGame.Name}`

          : dnaBrushActive

            ? `${dnaSelection.length.toLocaleString()} games after DNA refinement`

            : mapSelection.length > 0

              ? `${mapSelection.length.toLocaleString()} games selected on Game Map — lock the region to refine it`

              : searchActive

                ? `${searchedGameIds.size.toLocaleString()} search matches`

                : marketFocusActive

                  ? (
                      marketRegionCount ===
                      games.length

                        ? `Market focus: ${games.length.toLocaleString()} games`

                        : `Market focus: ${games.length.toLocaleString()} current games (${marketRegionCount.toLocaleString()} total in region)`
                    )

                  : `${games.length.toLocaleString()} visible games`}

      </div>

    </section>
  );

}


export default GameDNAView;