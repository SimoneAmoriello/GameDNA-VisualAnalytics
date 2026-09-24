import {
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


// Adds some visual space around the locked Market Focus.
function getPaddedDomain(
  minValue,
  maxValue,
  fullDomain,
) {

  const [fullMin, fullMax] =
    fullDomain;

  const focusSpan =
    maxValue - minValue;

  const fullSpan =
    fullMax - fullMin;


  // Normally use 12% of the selected region.
  // The second value prevents an extremely tiny
  // selection from producing an excessive zoom.
  const padding =
    Math.max(
      focusSpan * 0.12,
      fullSpan * 0.015
    );


  return [
    Math.max(
      fullMin,
      minValue - padding
    ),

    Math.min(
      fullMax,
      maxValue + padding
    ),
  ];

}


function GameMap({
  games,
  allGames,

  searchedGameIds,
  searchActive,

  selectedGame,
  hoveredGame,

  mapSelection,

  marketFocusBounds,
  marketRegionCount,
  focusGameCount,

  dnaSelection,
  dnaBrushActive,

  mapBrushResetToken,

  onGameSelect,
  onGameHover,
  onMapBrush,
  onLockFocus,
  onClearFocus,
}) {

  const width = 900;
  const height = 390;

  const margin = {
    top: 15,
    right: 20,
    bottom: 50,
    left: 65,
  };


  const [tooltip, setTooltip] =
    useState(null);


  const xAxisRef =
    useRef(null);

  const yAxisRef =
    useRef(null);

  const mapContainerRef =
    useRef(null);

  const brushRef =
    useRef(null);

  const brushBehaviorRef =
    useRef(null);

  const suppressBrushEventsRef =
    useRef(false);

  const isBrushingRef =
    useRef(false);


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


  // -------------------------------------------------------
  // Full PCA domains
  // -------------------------------------------------------
  //
  // These always represent the complete dataset.
  // They are also used when Clear Focus / Reset is pressed.
  // -------------------------------------------------------

  const fullXDomain =
    useMemo(() => {

      const extent =
        d3.extent(
          allGames,
          (game) =>
            game.PC1
        );


      return d3
        .scaleLinear()
        .domain(extent)
        .nice()
        .domain();

    }, [allGames]);


  const fullYDomain =
    useMemo(() => {

      const extent =
        d3.extent(
          allGames,
          (game) =>
            game.PC2
        );


      return d3
        .scaleLinear()
        .domain(extent)
        .nice()
        .domain();

    }, [allGames]);


  // -------------------------------------------------------
  // Visible X domain
  // -------------------------------------------------------
  //
  // No Market Focus:
  // → full PCA
  //
  // Market Focus:
  // → selected PC1 range + padding
  // -------------------------------------------------------

  const visibleXDomain =
    useMemo(() => {

      if (!marketFocusBounds) {

        return fullXDomain;

      }


      return getPaddedDomain(
        marketFocusBounds.pc1Min,
        marketFocusBounds.pc1Max,
        fullXDomain
      );

    }, [
      marketFocusBounds,
      fullXDomain,
    ]);


  // -------------------------------------------------------
  // Visible Y domain
  // -------------------------------------------------------

  const visibleYDomain =
    useMemo(() => {

      if (!marketFocusBounds) {

        return fullYDomain;

      }


      return getPaddedDomain(
        marketFocusBounds.pc2Min,
        marketFocusBounds.pc2Max,
        fullYDomain
      );

    }, [
      marketFocusBounds,
      fullYDomain,
    ]);


  // -------------------------------------------------------
  // X scale
  // -------------------------------------------------------

  const xScale =
    useMemo(() => {

      return d3
        .scaleLinear()
        .domain(
          visibleXDomain
        )
        .range([
          margin.left,
          width - margin.right,
        ]);

    }, [
      visibleXDomain,
    ]);


  // -------------------------------------------------------
  // Y scale
  // -------------------------------------------------------

  const yScale =
    useMemo(() => {

      return d3
        .scaleLinear()
        .domain(
          visibleYDomain
        )
        .range([
          height - margin.bottom,
          margin.top,
        ]);

    }, [
      visibleYDomain,
    ]);


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
  // Locked Market Focus rectangle
  // -------------------------------------------------------

  const focusRectangle =
    useMemo(() => {

      if (!marketFocusBounds) {

        return null;

      }


      const xA =
        xScale(
          marketFocusBounds.pc1Min
        );

      const xB =
        xScale(
          marketFocusBounds.pc1Max
        );

      const yA =
        yScale(
          marketFocusBounds.pc2Min
        );

      const yB =
        yScale(
          marketFocusBounds.pc2Max
        );


      return {

        x:
          Math.min(
            xA,
            xB
          ),

        y:
          Math.min(
            yA,
            yB
          ),

        width:
          Math.abs(
            xB - xA
          ),

        height:
          Math.abs(
            yB - yA
          ),

      };

    }, [
      marketFocusBounds,
      xScale,
      yScale,
    ]);


  // -------------------------------------------------------
  // Hovered game visible on the Map
  // -------------------------------------------------------

  const hoveredMapGame =
    useMemo(() => {

      if (!hoveredGame) {

        return null;

      }


      return (
        games.find(
          (game) =>
            game.AppID ===
            hoveredGame.AppID
        ) || null
      );

    }, [
      games,
      hoveredGame,
    ]);


  // -------------------------------------------------------
  // Helpers
  // -------------------------------------------------------

  function isSearched(game) {

    return searchedGameIds.has(
      game.AppID
    );

  }


  function isInsideMarketFocus(
    game
  ) {

    if (!marketFocusBounds) {

      return true;

    }


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


  // -------------------------------------------------------
  // X axis
  // -------------------------------------------------------

  useEffect(() => {

    const xAxis =
      d3.axisBottom(
        xScale
      );


    d3
      .select(
        xAxisRef.current
      )
      .call(
        xAxis
      );

  }, [xScale]);


  // -------------------------------------------------------
  // Y axis
  // -------------------------------------------------------

  useEffect(() => {

    const yAxis =
      d3.axisLeft(
        yScale
      );


    d3
      .select(
        yAxisRef.current
      )
      .call(
        yAxis
      );

  }, [yScale]);


  // -------------------------------------------------------
  // Game Map brush
  // -------------------------------------------------------

  useEffect(() => {

    const brushGroup =
      d3.select(
        brushRef.current
      );


    // When Market Focus is active,
    // the Game Map brush is disabled.
    if (marketFocusBounds) {

      brushBehaviorRef.current =
        null;


      brushGroup
        .selectAll("*")
        .remove();


      return;

    }


    const brush =
      d3
        .brush()

        .extent([
          [
            margin.left,
            margin.top,
          ],
          [
            width - margin.right,
            height - margin.bottom,
          ],
        ])


        // -----------------------------------------------
        // Brush starts
        // -----------------------------------------------

        .on(
          "start",
          () => {

            isBrushingRef.current =
              true;


            setTooltip(
              null
            );


            onGameHover(
              null
            );

          }
        )


        // -----------------------------------------------
        // Brush ends
        // -----------------------------------------------

        .on(
          "end",
          (event) => {

            isBrushingRef.current =
              false;


            if (
              suppressBrushEventsRef
                .current
            ) {

              return;

            }


            const selection =
              event.selection;


            // Brush removed
            if (!selection) {

              onMapBrush(
                [],
                null
              );

              return;

            }


            const [
              [x0, y0],
              [x1, y1],
            ] = selection;


            // -------------------------------------------
            // Convert pixel coordinates into PCA values
            // -------------------------------------------

            const pc1A =
              xScale.invert(
                x0
              );

            const pc1B =
              xScale.invert(
                x1
              );


            const pc2A =
              yScale.invert(
                y0
              );

            const pc2B =
              yScale.invert(
                y1
              );


            const bounds = {

              pc1Min:
                Math.min(
                  pc1A,
                  pc1B
                ),

              pc1Max:
                Math.max(
                  pc1A,
                  pc1B
                ),

              pc2Min:
                Math.min(
                  pc2A,
                  pc2B
                ),

              pc2Max:
                Math.max(
                  pc2A,
                  pc2B
                ),

            };


            // -------------------------------------------
            // Search restricts the selectable games.
            // Genre filtering was already applied
            // through the games prop.
            // -------------------------------------------

            const candidates =
              searchActive

                ? games.filter(
                    (game) =>
                      searchedGameIds.has(
                        game.AppID
                      )
                  )

                : games;


            const brushedGames =
              candidates.filter(
                (game) => {

                  const x =
                    xScale(
                      game.PC1
                    );

                  const y =
                    yScale(
                      game.PC2
                    );


                  return (
                    x >= x0 &&
                    x <= x1 &&
                    y >= y0 &&
                    y <= y1
                  );

                }
              );


            onMapBrush(
              brushedGames,
              bounds
            );

          }
        );


    brushBehaviorRef.current =
      brush;


    brushGroup.call(
      brush
    );


    return () => {

      brushGroup.on(
        ".brush",
        null
      );

    };

  }, [
    games,
    marketFocusBounds,
    searchActive,
    searchedGameIds,
    xScale,
    yScale,
    onGameHover,
    onMapBrush,
  ]);


  // -------------------------------------------------------
  // Remove temporary Map brush
  // -------------------------------------------------------

  useEffect(() => {

    if (
      !brushRef.current ||
      !brushBehaviorRef.current
    ) {

      return;

    }


    suppressBrushEventsRef
      .current = true;


    d3
      .select(
        brushRef.current
      )
      .call(
        brushBehaviorRef
          .current
          .move,
        null
      );


    suppressBrushEventsRef
      .current = false;

  }, [
    mapBrushResetToken,
  ]);


  // -------------------------------------------------------
  // Remove tooltip after context changes
  // -------------------------------------------------------

  useEffect(() => {

    setTooltip(
      null
    );

  }, [
    marketFocusBounds,
    searchActive,
    dnaBrushActive,
  ]);


  // -------------------------------------------------------
  // Interface
  // -------------------------------------------------------

  return (
    <section className="panel game-map">

      <div className="panel-header">

        <div>

          <h2>
            Game Map
          </h2>


          <p className="panel-description">

            {marketFocusBounds
              ? "Detailed view of the locked PCA market region"
              : "PCA projection of the 5,000 Steam games"}

          </p>

        </div>

      </div>


      <div
        className="game-map-content"
        ref={
          mapContainerRef
        }
      >

        <svg
          viewBox={
            `0 0 ${width} ${height}`
          }

          className="game-map-svg"
        >

          {/* ------------------------------------------------
              Clip everything inside the PCA plotting area.

              This is especially important after zooming:
              games outside the visible zoom should not
              appear over axes or labels.
              ------------------------------------------------ */}

          <defs>

            <clipPath id="game-map-plot-clip">

              <rect
                x={
                  margin.left
                }

                y={
                  margin.top
                }

                width={
                  width -
                  margin.left -
                  margin.right
                }

                height={
                  height -
                  margin.top -
                  margin.bottom
                }
              />

            </clipPath>

          </defs>


          {/* X axis */}
          <g
            ref={
              xAxisRef
            }

            transform={
              `translate(0, ${
                height -
                margin.bottom
              })`
            }
          />


          {/* Y axis */}
          <g
            ref={
              yAxisRef
            }

            transform={
              `translate(${
                margin.left
              }, 0)`
            }
          />


          {/* ------------------------------------------------
              Plot contents
              ------------------------------------------------ */}

          <g
            clipPath="url(#game-map-plot-clip)"
          >

            {/* Locked Market Focus */}
            {focusRectangle && (

              <rect
                x={
                  focusRectangle.x
                }

                y={
                  focusRectangle.y
                }

                width={
                  focusRectangle.width
                }

                height={
                  focusRectangle.height
                }

                className="market-focus-rectangle"

                pointerEvents="none"
              />

            )}


            {/* Games */}
            {games.map(
              (game) => {

                const hovered =
                  hoveredGame?.AppID ===
                    game.AppID;


                const searched =
                  isSearched(
                    game
                  );


                const clicked =
                  selectedGame?.AppID ===
                    game.AppID;


                const mapSelected =
                  mapSelectionIds.has(
                    game.AppID
                  );


                const mapBrushActive =
                  mapSelectionIds.size > 0;


                const inFocus =
                  isInsideMarketFocus(
                    game
                  );


                const dnaSelected =
                  dnaSelectionIds.has(
                    game.AppID
                  );


                // -----------------------------------------
                // Interaction availability
                // -----------------------------------------

                let interactive =
                  true;


                if (
                  marketFocusBounds &&
                  !inFocus
                ) {

                  interactive =
                    false;

                }


                if (
                  searchActive &&
                  !searched
                ) {

                  interactive =
                    false;

                }


                if (
                  dnaBrushActive &&
                  !dnaSelected
                ) {

                  interactive =
                    false;

                }


                if (
                  !marketFocusBounds &&
                  mapBrushActive &&
                  !mapSelected
                ) {

                  interactive =
                    false;

                }


                // -----------------------------------------
                // Radius
                // -----------------------------------------

                let radius =
                  2.5;


                if (searched) {

                  radius =
                    4;

                }


                if (mapSelected) {

                  radius =
                    4.5;

                }


                if (dnaSelected) {

                  radius =
                    4.8;

                }


                if (hovered) {

                  radius =
                    5;

                }


                if (clicked) {

                  radius =
                    6;

                }


                // -----------------------------------------
                // Opacity
                // -----------------------------------------

                let opacity =
                  0.5;


                // Temporary Map selection
                if (
                  !marketFocusBounds &&
                  mapBrushActive
                ) {

                  opacity =
                    mapSelected
                      ? 1
                      : 0.05;

                }


                // Market Focus active
                else if (
                  marketFocusBounds
                ) {

                  // DNA refinement
                  if (
                    dnaBrushActive
                  ) {

                    if (
                      dnaSelected
                    ) {

                      opacity =
                        1;

                    }

                    else if (
                      inFocus
                    ) {

                      opacity =
                        0.06;

                    }

                    else {

                      opacity =
                        0.015;

                    }

                  }


                  // Search inside Market Focus
                  else if (
                    searchActive
                  ) {

                    if (
                      searched
                    ) {

                      opacity =
                        0.9;

                    }

                    else if (
                      inFocus
                    ) {

                      opacity =
                        0.06;

                    }

                    else {

                      opacity =
                        0.015;

                    }

                  }


                  // Single clicked game
                  else if (
                    selectedGame
                  ) {

                    if (
                      clicked
                    ) {

                      opacity =
                        1;

                    }

                    else if (
                      inFocus
                    ) {

                      opacity =
                        0.12;

                    }

                    else {

                      opacity =
                        0.015;

                    }

                  }


                  // Normal Market Focus state
                  else {

                    opacity =
                      inFocus
                        ? 0.6
                        : 0.025;

                  }

                }


                // Search without Market Focus
                else if (
                  searchActive
                ) {

                  if (
                    selectedGame
                  ) {

                    if (
                      clicked
                    ) {

                      opacity =
                        1;

                    }

                    else if (
                      searched
                    ) {

                      opacity =
                        0.25;

                    }

                    else {

                      opacity =
                        0.03;

                    }

                  }

                  else {

                    opacity =
                      searched
                        ? 0.9
                        : 0.06;

                  }

                }


                // Single click without focus/search
                else if (
                  selectedGame
                ) {

                  opacity =
                    clicked
                      ? 1
                      : 0.15;

                }


                // -----------------------------------------
                // Border
                // -----------------------------------------

                let stroke =
                  "white";

                let strokeWidth =
                  0.4;


                if (
                  mapSelected
                ) {

                  stroke =
                    "#444";

                  strokeWidth =
                    1.2;

                }


                if (
                  dnaSelected
                ) {

                  stroke =
                    "#333";

                  strokeWidth =
                    1.4;

                }


                if (
                  clicked
                ) {

                  stroke =
                    "#111";

                  strokeWidth =
                    2.5;

                }


                return (

                  <circle
                    key={
                      game.AppID
                    }

                    cx={
                      xScale(
                        game.PC1
                      )
                    }

                    cy={
                      yScale(
                        game.PC2
                      )
                    }

                    r={
                      radius
                    }

                    fill={
                      colorScale(
                        game.DisplayGenre
                      )
                    }

                    opacity={
                      opacity
                    }

                    stroke={
                      stroke
                    }

                    strokeWidth={
                      strokeWidth
                    }

                    pointerEvents={
                      interactive
                        ? "auto"
                        : "none"
                    }


                    // -------------------------------------
                    // Click
                    // -------------------------------------

                    onClick={() => {

                      if (
                        !interactive ||
                        isBrushingRef.current
                      ) {

                        return;

                      }


                      onGameSelect(
                        game
                      );

                    }}


                    // -------------------------------------
                    // Hover start
                    // -------------------------------------

                    onMouseEnter={
                      (event) => {

                        if (
                          !interactive ||
                          isBrushingRef.current
                        ) {

                          return;

                        }


                        const bounds =
                          mapContainerRef
                            .current
                            .getBoundingClientRect();


                        setTooltip({

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


                    // -------------------------------------
                    // Hover move
                    // -------------------------------------

                    onMouseMove={
                      (event) => {

                        if (
                          !interactive ||
                          isBrushingRef.current
                        ) {

                          return;

                        }


                        const bounds =
                          mapContainerRef
                            .current
                            .getBoundingClientRect();


                        setTooltip(
                          (current) => {

                            if (!current) {

                              return null;

                            }


                            return {

                              ...current,

                              x:
                                event.clientX -
                                bounds.left,

                              y:
                                event.clientY -
                                bounds.top,

                              containerWidth:
                                bounds.width,

                            };

                          }
                        );

                      }
                    }


                    // -------------------------------------
                    // Hover end
                    // -------------------------------------

                    onMouseLeave={() => {

                      setTooltip(
                        null
                      );


                      onGameHover(
                        null
                      );

                    }}
                  />

                );

              }
            )}


            {/* --------------------------------------------
                Linked hover outline

                Drawn AFTER all points so that it is
                always visible above them.
                -------------------------------------------- */}

            {hoveredMapGame && (

              <circle
                cx={
                  xScale(
                    hoveredMapGame.PC1
                  )
                }

                cy={
                  yScale(
                    hoveredMapGame.PC2
                  )
                }

                r={6.2}

                fill="none"

                stroke="#111"

                strokeWidth={2}

                pointerEvents="none"
              />

            )}

          </g>


          {/* ------------------------------------------------
              Temporary Map brush

              This stays outside the clip group because D3
              controls its own extent.
              ------------------------------------------------ */}

          <g
            ref={
              brushRef
            }

            className="brush"
          />


          {/* X label */}
          <text
            x={
              width / 2
            }

            y={
              height - 10
            }

            textAnchor="middle"

            className="axis-label"
          >

            PC1 — Market Presence (33.83%)

          </text>


          {/* Y label */}
          <text
            transform={
              `translate(18, ${
                height / 2
              }) rotate(-90)`
            }

            textAnchor="middle"

            className="axis-label"
          >

            PC2 — Market Legacy (20.00%)

          </text>

        </svg>


        {/* ------------------------------------------------
            Tooltip
            ------------------------------------------------ */}

        {tooltip && (

          <div
            className="game-tooltip"

            style={{

              left:
                tooltip.x >
                tooltip.containerWidth -
                  270

                  ? tooltip.x -
                    257

                  : tooltip.x +
                    12,


              top:
                tooltip.y +
                12,

            }}
          >

            <div className="tooltip-title">

              {tooltip.game.Name}

            </div>


            <div className="tooltip-genre">

              {tooltip.game.DisplayGenre}

            </div>


            <div className="tooltip-grid">

              <span>
                Popularity
              </span>

              <strong>

                {tooltip.game
                  .Popularity
                  .toLocaleString()}{" "}
                reviews

              </strong>


              <span>
                Appreciation
              </span>

              <strong>

                {(
                  tooltip.game
                    .Appreciation *
                  100
                ).toFixed(1)}
                %

              </strong>


              <span>
                Engagement
              </span>

              <strong>

                {(
                  tooltip.game
                    .Engagement /
                  60
                ).toFixed(1)}{" "}
                h

              </strong>


              <span>
                Price
              </span>

              <strong>

                $
                {tooltip.game
                  .CommercialPosition
                  .toFixed(2)}

              </strong>


              <span>
                Maturity
              </span>

              <strong>

                {tooltip.game
                  .Maturity
                  .toFixed(1)}{" "}
                years

              </strong>


              <span>
                Market Reach
              </span>

              <strong>

                {tooltip.game
                  .MarketReach}{" "}
                languages

              </strong>

            </div>

          </div>

        )}


        {/* ------------------------------------------------
            Genre legend
            ------------------------------------------------ */}

        <div className="genre-legend">

          {DISPLAY_GENRES.map(
            (genre) => (

              <div
                className="legend-item"
                key={
                  genre
                }
              >

                <span
                  className="legend-dot"

                  style={{
                    backgroundColor:
                      colorScale(
                        genre
                      ),
                  }}
                />


                <span>
                  {genre}
                </span>

              </div>

            )
          )}

        </div>


        {/* ------------------------------------------------
            Selection / Focus controls
            ------------------------------------------------ */}

        <div className="map-selection-status">

          {marketFocusBounds ? (

            <div className="focus-control-row">

              <span>

                {selectedGame

                  ? `Selected game: ${selectedGame.Name}`

                  : dnaBrushActive

                    ? `${dnaSelection.length.toLocaleString()} games after DNA refinement`

                    : searchActive

                      ? `${searchedGameIds.size.toLocaleString()} search matches inside Market Focus`

                      : `Market Focus: ${focusGameCount.toLocaleString()} current games (${marketRegionCount.toLocaleString()} total in region)`}

              </span>


              <button
                type="button"
                className="focus-button"
                onClick={
                  onClearFocus
                }
              >

                Clear focus

              </button>

            </div>

          ) : mapSelection.length > 0 ? (

            <div className="focus-control-row">

              <span>

                {mapSelection.length
                  .toLocaleString()}{" "}
                games selected

              </span>


              <button
                type="button"
                className="focus-button"
                onClick={
                  onLockFocus
                }
              >

                Focus on selection

              </button>

            </div>

          ) : selectedGame ? (

            <span>

              Selected game:{" "}
              {selectedGame.Name}

            </span>

          ) : (

            <span>

              Drag on empty space to select a market region, or click a game.

            </span>

          )}

        </div>

      </div>

    </section>
  );

}


export default GameMap;