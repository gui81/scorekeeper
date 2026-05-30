import { defineComponent, ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useTracker, useSubscribe, useActiveOrg } from '../composables';
import {
  Players,
  Matches,
  CombinedRatings,
  SinglesRatings,
  OffenseRatings,
  DefenseRatings,
} from '../../api/collections';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

function getRatingClass(rating) {
  if (rating >= 2500) return 'Master-Elite';
  if (rating >= 2000) return 'Master';
  if (rating >= 1500) return 'Expert-Elite';
  if (rating >= 1000) return 'Expert';
  if (rating >= 500) return 'Novice-Elite';
  return 'Novice';
}

function buildRatingChartData(playerId) {
  const collections = [
    { collection: CombinedRatings, label: 'Combined', color: '#4a90d9' },
    { collection: SinglesRatings, label: 'Singles', color: '#e74c3c' },
    { collection: OffenseRatings, label: 'Offense', color: '#2ecc71' },
    { collection: DefenseRatings, label: 'Defense', color: '#f39c12' },
  ];

  const datasets = collections.map(({ collection, label, color }) => {
    const ratings = collection.find({ player_id: playerId }, { sort: { date_time: 1 } }).fetch();
    return {
      label,
      data: ratings.map((r) => ({ x: r.date_time, y: r.rating })),
      borderColor: color,
      backgroundColor: color + '20',
      fill: false,
      tension: 0.2,
    };
  });

  return { datasets };
}

function computePlayerStats(playerId, allMatches, allPlayers) {
  const matches = allMatches.filter(
    (m) =>
      m.ro_id === playerId || m.rd_id === playerId || m.bo_id === playerId || m.bd_id === playerId,
  );

  // Sort by date for streak calculations
  const sorted = [...matches].sort((a, b) => a.date_time - b.date_time);

  let wins = 0,
    losses = 0,
    ties = 0;
  let singlesWins = 0,
    singlesLosses = 0,
    singlesTies = 0;
  let doublesWins = 0,
    doublesLosses = 0,
    doublesTies = 0;
  let offWins = 0,
    offLosses = 0,
    offTies = 0;
  let defWins = 0,
    defLosses = 0,
    defTies = 0;
  let totalScored = 0,
    totalAllowed = 0;
  let shutoutWins = 0,
    shutoutLosses = 0;
  let blowoutWins = 0,
    blowoutLosses = 0;
  let closeWins = 0,
    closeLosses = 0;
  let currentStreak = 0;
  let currentStreakType = null;
  let longestWinStreak = 0;
  let tempWinStreak = 0;

  // Head-to-head tracking
  const h2h = {};
  // Partner tracking
  const partners = {};

  sorted.forEach((m) => {
    const rs = parseInt(m.rs, 10);
    const bs = parseInt(m.bs, 10);
    const diff = Math.abs(rs - bs);

    const isOnRed = m.ro_id === playerId || m.rd_id === playerId;
    const playerWon = isOnRed ? rs > bs : bs > rs;
    const playerTied = rs === bs;
    const playerLost = !playerWon && !playerTied;
    const scored = isOnRed ? rs : bs;
    const allowed = isOnRed ? bs : rs;

    const isSingles = !m.rd_id && !m.bd_id;
    const isDoubles = !!m.rd_id && !!m.bd_id;

    const isOffense = m.ro_id === playerId || m.bo_id === playerId;
    const isDefense = m.rd_id === playerId || m.bd_id === playerId;

    // Win/loss/tie totals
    if (playerWon) wins++;
    else if (playerTied) ties++;
    else losses++;

    // Singles/doubles
    if (isSingles) {
      if (playerWon) singlesWins++;
      else if (playerTied) singlesTies++;
      else singlesLosses++;
    }
    if (isDoubles) {
      if (playerWon) doublesWins++;
      else if (playerTied) doublesTies++;
      else doublesLosses++;
    }

    // Position
    if (isOffense) {
      if (playerWon) offWins++;
      else if (playerTied) offTies++;
      else offLosses++;
    }
    if (isDefense) {
      if (playerWon) defWins++;
      else if (playerTied) defTies++;
      else defLosses++;
    }

    // Scoring
    totalScored += scored;
    totalAllowed += allowed;

    // Shutouts (decisive games only — a 0-0 tie is not a shutout)
    if (playerWon && allowed === 0) shutoutWins++;
    if (playerLost && scored === 0) shutoutLosses++;

    // Blowouts (5+ point diff — never a tie)
    if (diff >= 5) {
      if (playerWon) blowoutWins++;
      else blowoutLosses++;
    }

    // Close games (1-2 point diff, decisive only)
    if (diff <= 2) {
      if (playerWon) closeWins++;
      else if (playerLost) closeLosses++;
    }

    // Streaks
    if (playerWon) {
      tempWinStreak++;
      longestWinStreak = Math.max(longestWinStreak, tempWinStreak);
      if (currentStreakType === 'W') {
        currentStreak++;
      } else {
        currentStreakType = 'W';
        currentStreak = 1;
      }
    } else {
      tempWinStreak = 0;
      const streakType = playerTied ? 'T' : 'L';
      if (currentStreakType === streakType) {
        currentStreak++;
      } else {
        currentStreakType = streakType;
        currentStreak = 1;
      }
    }

    // Head-to-head: identify opponents
    const opponents = [];
    if (isOnRed) {
      if (m.bo_id) opponents.push(m.bo_id);
      if (m.bd_id) opponents.push(m.bd_id);
    } else {
      if (m.ro_id) opponents.push(m.ro_id);
      if (m.rd_id) opponents.push(m.rd_id);
    }
    opponents.forEach((oppId) => {
      if (!h2h[oppId]) h2h[oppId] = { wins: 0, losses: 0, ties: 0 };
      if (playerWon) h2h[oppId].wins++;
      else if (playerTied) h2h[oppId].ties++;
      else h2h[oppId].losses++;
    });

    // Partner tracking (doubles only)
    if (isDoubles) {
      let partnerId;
      if (isOnRed) {
        partnerId = m.ro_id === playerId ? m.rd_id : m.ro_id;
      } else {
        partnerId = m.bo_id === playerId ? m.bd_id : m.bo_id;
      }
      if (partnerId) {
        if (!partners[partnerId]) partners[partnerId] = { wins: 0, losses: 0, ties: 0 };
        if (playerWon) partners[partnerId].wins++;
        else if (playerTied) partners[partnerId].ties++;
        else partners[partnerId].losses++;
      }
    }
  });

  const totalMatches = wins + losses + ties;
  const winPct = totalMatches > 0 ? Math.round(((wins + 0.5 * ties) / totalMatches) * 100) : 0;

  // Build head-to-head list
  const h2hList = Object.entries(h2h)
    .map(([oppId, record]) => {
      const opp = allPlayers.find((p) => p._id === oppId);
      const total = record.wins + record.losses + record.ties;
      return {
        id: oppId,
        name: opp ? opp.name : 'Unknown',
        wins: record.wins,
        losses: record.losses,
        ties: record.ties,
        pct: total > 0 ? Math.round(((record.wins + 0.5 * record.ties) / total) * 100) : 0,
      };
    })
    .sort((a, b) => b.wins + b.losses + b.ties - (a.wins + a.losses + a.ties));

  // Build partner list
  const partnerList = Object.entries(partners)
    .map(([pId, record]) => {
      const p = allPlayers.find((pl) => pl._id === pId);
      const total = record.wins + record.losses + record.ties;
      return {
        id: pId,
        name: p ? p.name : 'Unknown',
        wins: record.wins,
        losses: record.losses,
        ties: record.ties,
        pct: total > 0 ? Math.round(((record.wins + 0.5 * record.ties) / total) * 100) : 0,
      };
    })
    .sort((a, b) => b.pct - a.pct);

  // Nemesis (opponent with most wins against this player, min 2 matches)
  const nemesis =
    h2hList
      .filter((o) => o.wins + o.losses + o.ties >= 2)
      .sort((a, b) => b.losses - a.losses || a.pct - b.pct)[0] || null;

  // Favorite opponent (opponent this player beats most, min 2 matches)
  const favorite =
    h2hList.filter((o) => o.wins + o.losses + o.ties >= 2).sort((a, b) => b.pct - a.pct)[0] || null;

  // Best/worst partner (min 2 matches)
  const qualifiedPartners = partnerList.filter((p) => p.wins + p.losses + p.ties >= 2);
  const bestPartner = qualifiedPartners[0] || null;
  const worstPartner =
    qualifiedPartners.length > 0 ? qualifiedPartners[qualifiedPartners.length - 1] : null;

  // Rating stats
  function getRatingStats(collection) {
    const ratings = collection.find({ player_id: playerId }, { sort: { date_time: 1 } }).fetch();
    if (ratings.length === 0) return { current: 'N/A', peak: 'N/A', trend: 'N/A' };
    const current = Math.round(ratings[ratings.length - 1].rating);
    const peak = Math.round(Math.max(...ratings.map((r) => r.rating)));
    // Trend: change over last 10 data points
    const recentStart =
      ratings.length > 10 ? ratings[ratings.length - 11].rating : ratings[0].rating;
    const trend = Math.round(ratings[ratings.length - 1].rating - recentStart);
    return { current, peak, trend };
  }

  const combinedRating = getRatingStats(CombinedRatings);
  const singlesRating = getRatingStats(SinglesRatings);
  const offenseRating = getRatingStats(OffenseRatings);
  const defenseRating = getRatingStats(DefenseRatings);

  // Current rank among all players
  const allPlayersList = allPlayers.slice();
  const allCombinedRatings = allPlayersList
    .map((p) => {
      const r = CombinedRatings.findOne({ player_id: p._id }, { sort: { date_time: -1 } });
      return { playerId: p._id, rating: r ? r.rating : 0 };
    })
    .sort((a, b) => b.rating - a.rating);
  const rank = allCombinedRatings.findIndex((r) => r.playerId === playerId) + 1;

  return {
    totalMatches,
    wins,
    losses,
    ties,
    winPct,
    singlesWins,
    singlesLosses,
    singlesTies,
    doublesWins,
    doublesLosses,
    doublesTies,
    offWins,
    offLosses,
    offTies,
    defWins,
    defLosses,
    defTies,
    avgScored: totalMatches > 0 ? (totalScored / totalMatches).toFixed(1) : '0.0',
    avgAllowed: totalMatches > 0 ? (totalAllowed / totalMatches).toFixed(1) : '0.0',
    pointDiff: totalScored - totalAllowed,
    shutoutWins,
    shutoutLosses,
    blowoutWins,
    blowoutLosses,
    closeWins,
    closeLosses,
    currentStreak: totalMatches > 0 ? `${currentStreak}${currentStreakType}` : 'N/A',
    longestWinStreak,
    combinedRating,
    singlesRating,
    offenseRating,
    defenseRating,
    ratingClass: combinedRating.current !== 'N/A' ? getRatingClass(combinedRating.current) : 'N/A',
    rank,
    totalPlayers: allPlayersList.length,
    h2hList,
    partnerList,
    nemesis,
    favorite,
    bestPartner,
    worstPartner,
  };
}

export default defineComponent({
  name: 'PlayerDetail',
  props: {
    id: { type: String, required: true },
  },
  setup(props) {
    const { activeOrgId } = useActiveOrg();

    const matchesReady = useSubscribe('matches', activeOrgId.value);
    const playersReady = useSubscribe('players', activeOrgId.value);
    const combinedReady = useSubscribe('combined_ratings', activeOrgId.value);
    const singlesReady = useSubscribe('singles_ratings', activeOrgId.value);
    const offenseReady = useSubscribe('offense_ratings', activeOrgId.value);
    const defenseReady = useSubscribe('defense_ratings', activeOrgId.value);

    const chartCanvas = ref(null);
    let chartInstance = null;
    const mounted = ref(false);

    onMounted(() => {
      mounted.value = true;
    });

    const h2hSortCol = ref('pct');
    const h2hSortAsc = ref(false);

    const player = useTracker(() => {
      return Players.findOne({ _id: props.id });
    });

    const stats = useTracker(() => {
      const p = Players.findOne({ _id: props.id });
      if (!p) return null;
      const allMatches = Matches.find({}).fetch();
      const allPlayers = Players.find({}).fetch();
      return computePlayerStats(props.id, allMatches, allPlayers);
    });

    const sortedH2h = computed(() => {
      if (!stats.value) return [];
      const data = [...stats.value.h2hList];
      const col = h2hSortCol.value;
      const asc = h2hSortAsc.value;
      data.sort((a, b) => {
        const aVal = a[col];
        const bVal = b[col];
        if (typeof aVal === 'string')
          return asc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        return asc ? aVal - bVal : bVal - aVal;
      });
      return data;
    });

    function toggleH2hSort(col) {
      if (h2hSortCol.value === col) {
        h2hSortAsc.value = !h2hSortAsc.value;
      } else {
        h2hSortCol.value = col;
        h2hSortAsc.value = false;
      }
    }

    function h2hSortIndicator(col) {
      if (h2hSortCol.value !== col) return '';
      return h2hSortAsc.value ? ' ▲' : ' ▼';
    }

    function buildChart() {
      if (!chartCanvas.value || !player.value) return;
      if (chartInstance) chartInstance.destroy();

      const data = buildRatingChartData(props.id);
      chartInstance = new Chart(chartCanvas.value, {
        type: 'line',
        data,
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: { display: true, text: 'Rating History', font: { size: 16 } },
            legend: { position: 'bottom' },
            tooltip: {
              callbacks: {
                title(items) {
                  if (!items.length) return '';
                  return new Date(items[0].parsed.x).toLocaleString();
                },
              },
            },
          },
          scales: {
            x: {
              type: 'linear',
              title: { display: true, text: 'Time' },
              ticks: {
                callback(value) {
                  return new Date(value).toLocaleDateString();
                },
              },
            },
            y: {
              title: { display: true, text: 'Rating (Elo)' },
              ticks: { precision: 0 },
            },
          },
        },
      });
    }

    // Build chart when subscriptions are ready and DOM is mounted
    watch(
      [
        mounted,
        matchesReady,
        playersReady,
        combinedReady,
        singlesReady,
        offenseReady,
        defenseReady,
      ],
      ([m, mr, p, c, s, o, d]) => {
        if (m && mr && p && c && s && o && d && chartCanvas.value && player.value) {
          buildChart();
        }
      },
    );

    // Also rebuild when stats change (e.g. new match added)
    watch(
      stats,
      () => {
        if (mounted.value && chartCanvas.value && stats.value) buildChart();
      },
      { deep: true },
    );

    onUnmounted(() => {
      if (chartInstance) chartInstance.destroy();
    });

    function trendArrow(trend) {
      if (trend === 'N/A') return '';
      if (trend > 0) return '+' + trend + ' ▲';
      if (trend < 0) return trend + ' ▼';
      return '0 ―';
    }

    function trendClass(trend) {
      if (trend > 0) return 'text-success';
      if (trend < 0) return 'text-danger';
      return 'text-muted';
    }

    function pctDisplay(wins, losses, ties = 0) {
      const total = wins + losses + ties;
      return total > 0 ? Math.round(((wins + 0.5 * ties) / total) * 100) + '%' : 'N/A';
    }

    return {
      player,
      stats,
      chartCanvas,
      sortedH2h,
      toggleH2hSort,
      h2hSortIndicator,
      trendArrow,
      trendClass,
      pctDisplay,
    };
  },
  template: `
    <div class="container" v-if="player && stats">
      <div class="row justify-content-center">
        <div class="col-lg-10">

          <!-- Player Header -->
          <div class="d-flex align-items-center mb-4 flex-wrap gap-2">
            <h2 class="mb-0">{{ player.name }}</h2>
            <span class="badge bg-primary fs-6">{{ stats.ratingClass }}</span>
            <span class="badge bg-secondary fs-6">Rank #{{ stats.rank }} / {{ stats.totalPlayers }}</span>
          </div>

          <!-- Rating Cards -->
          <div class="row g-3 mb-4">
            <div class="col-6 col-md-3" v-for="r in [
              { label: 'Combined', data: stats.combinedRating },
              { label: 'Singles', data: stats.singlesRating },
              { label: 'Offense', data: stats.offenseRating },
              { label: 'Defense', data: stats.defenseRating },
            ]" :key="r.label">
              <div class="card text-center h-100">
                <div class="card-body py-2">
                  <div class="text-muted small">{{ r.label }}</div>
                  <div class="fs-4 fw-bold">{{ r.data.current }}</div>
                  <div class="small">Peak: {{ r.data.peak }}</div>
                  <div class="small" :class="trendClass(r.data.trend)">{{ trendArrow(r.data.trend) }}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Rating Chart -->
          <div class="chart-container mb-4" style="position: relative; height: 350px;">
            <canvas ref="chartCanvas"></canvas>
          </div>

          <!-- Record Overview -->
          <div class="row g-3 mb-4">
            <div class="col-md-6">
              <div class="card h-100">
                <div class="card-header fw-bold">Record</div>
                <div class="card-body">
                  <table class="table table-sm mb-0">
                    <tbody>
                      <tr>
                        <td>Overall</td>
                        <td class="fw-bold">{{ stats.wins }}W - {{ stats.losses }}L - {{ stats.ties }}D</td>
                        <td>{{ stats.winPct }}%</td>
                      </tr>
                      <tr>
                        <td>Singles</td>
                        <td>{{ stats.singlesWins }}W - {{ stats.singlesLosses }}L - {{ stats.singlesTies }}D</td>
                        <td>{{ pctDisplay(stats.singlesWins, stats.singlesLosses, stats.singlesTies) }}</td>
                      </tr>
                      <tr>
                        <td>Doubles</td>
                        <td>{{ stats.doublesWins }}W - {{ stats.doublesLosses }}L - {{ stats.doublesTies }}D</td>
                        <td>{{ pctDisplay(stats.doublesWins, stats.doublesLosses, stats.doublesTies) }}</td>
                      </tr>
                      <tr>
                        <td>As Offense</td>
                        <td>{{ stats.offWins }}W - {{ stats.offLosses }}L - {{ stats.offTies }}D</td>
                        <td>{{ pctDisplay(stats.offWins, stats.offLosses, stats.offTies) }}</td>
                      </tr>
                      <tr>
                        <td>As Defense</td>
                        <td>{{ stats.defWins }}W - {{ stats.defLosses }}L - {{ stats.defTies }}D</td>
                        <td>{{ pctDisplay(stats.defWins, stats.defLosses, stats.defTies) }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div class="col-md-6">
              <div class="card h-100">
                <div class="card-header fw-bold">Scoring</div>
                <div class="card-body">
                  <table class="table table-sm mb-0">
                    <tbody>
                      <tr>
                        <td>Avg Points Scored</td>
                        <td class="fw-bold">{{ stats.avgScored }}</td>
                      </tr>
                      <tr>
                        <td>Avg Points Allowed</td>
                        <td class="fw-bold">{{ stats.avgAllowed }}</td>
                      </tr>
                      <tr>
                        <td>Point Differential</td>
                        <td class="fw-bold" :class="stats.pointDiff >= 0 ? 'text-success' : 'text-danger'">
                          {{ stats.pointDiff >= 0 ? '+' : '' }}{{ stats.pointDiff }}
                        </td>
                      </tr>
                      <tr>
                        <td>Shutout Wins / Losses</td>
                        <td>{{ stats.shutoutWins }} / {{ stats.shutoutLosses }}</td>
                      </tr>
                      <tr>
                        <td>Blowouts (5+ pts)</td>
                        <td>{{ stats.blowoutWins }}W / {{ stats.blowoutLosses }}L</td>
                      </tr>
                      <tr>
                        <td>Close Games (1-2 pts)</td>
                        <td>{{ stats.closeWins }}W / {{ stats.closeLosses }}L</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          <!-- Streaks & Rivals Row -->
          <div class="row g-3 mb-4">
            <div class="col-md-6">
              <div class="card h-100">
                <div class="card-header fw-bold">Streaks</div>
                <div class="card-body">
                  <table class="table table-sm mb-0">
                    <tbody>
                      <tr>
                        <td>Current Streak</td>
                        <td class="fw-bold">{{ stats.currentStreak }}</td>
                      </tr>
                      <tr>
                        <td>Longest Win Streak</td>
                        <td class="fw-bold">{{ stats.longestWinStreak }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div class="col-md-6">
              <div class="card h-100">
                <div class="card-header fw-bold">Rivals &amp; Partners</div>
                <div class="card-body">
                  <table class="table table-sm mb-0">
                    <tbody>
                      <tr>
                        <td>Nemesis</td>
                        <td v-if="stats.nemesis">
                          <router-link :to="'/player/' + stats.nemesis.id">{{ stats.nemesis.name }}</router-link>
                          <small class="text-muted">({{ stats.nemesis.wins }}W-{{ stats.nemesis.losses }}L-{{ stats.nemesis.ties }}D)</small>
                        </td>
                        <td v-else class="text-muted">N/A</td>
                      </tr>
                      <tr>
                        <td>Favorite Opponent</td>
                        <td v-if="stats.favorite">
                          <router-link :to="'/player/' + stats.favorite.id">{{ stats.favorite.name }}</router-link>
                          <small class="text-muted">({{ stats.favorite.wins }}W-{{ stats.favorite.losses }}L-{{ stats.favorite.ties }}D)</small>
                        </td>
                        <td v-else class="text-muted">N/A</td>
                      </tr>
                      <tr>
                        <td>Best Partner</td>
                        <td v-if="stats.bestPartner">
                          <router-link :to="'/player/' + stats.bestPartner.id">{{ stats.bestPartner.name }}</router-link>
                          <small class="text-muted">({{ stats.bestPartner.pct }}% win)</small>
                        </td>
                        <td v-else class="text-muted">N/A</td>
                      </tr>
                      <tr>
                        <td>Worst Partner</td>
                        <td v-if="stats.worstPartner && stats.worstPartner.id !== (stats.bestPartner && stats.bestPartner.id)">
                          <router-link :to="'/player/' + stats.worstPartner.id">{{ stats.worstPartner.name }}</router-link>
                          <small class="text-muted">({{ stats.worstPartner.pct }}% win)</small>
                        </td>
                        <td v-else class="text-muted">N/A</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          <!-- Head-to-Head Table -->
          <div class="card mb-4">
            <div class="card-header fw-bold">Head-to-Head Records</div>
            <div class="card-body">
              <div class="table-responsive">
                <table class="table table-striped table-hover table-sm mb-0">
                  <thead>
                    <tr>
                      <th role="button" @click="toggleH2hSort('name')">Opponent{{ h2hSortIndicator('name') }}</th>
                      <th role="button" @click="toggleH2hSort('wins')">Wins{{ h2hSortIndicator('wins') }}</th>
                      <th role="button" @click="toggleH2hSort('losses')">Losses{{ h2hSortIndicator('losses') }}</th>
                      <th role="button" @click="toggleH2hSort('ties')">Ties{{ h2hSortIndicator('ties') }}</th>
                      <th role="button" @click="toggleH2hSort('pct')">Win %{{ h2hSortIndicator('pct') }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="opp in sortedH2h" :key="opp.id">
                      <td><router-link :to="'/player/' + opp.id">{{ opp.name }}</router-link></td>
                      <td>{{ opp.wins }}</td>
                      <td>{{ opp.losses }}</td>
                      <td>{{ opp.ties }}</td>
                      <td>{{ opp.pct }}%</td>
                    </tr>
                    <tr v-if="sortedH2h.length === 0">
                      <td colspan="5" class="text-center text-muted">No matches yet</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <!-- Partner Stats Table -->
          <div class="card mb-4" v-if="stats.partnerList.length > 0">
            <div class="card-header fw-bold">Doubles Partner Records</div>
            <div class="card-body">
              <div class="table-responsive">
                <table class="table table-striped table-hover table-sm mb-0">
                  <thead>
                    <tr>
                      <th>Partner</th>
                      <th>Wins</th>
                      <th>Losses</th>
                      <th>Ties</th>
                      <th>Win %</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="p in stats.partnerList" :key="p.id">
                      <td><router-link :to="'/player/' + p.id">{{ p.name }}</router-link></td>
                      <td>{{ p.wins }}</td>
                      <td>{{ p.losses }}</td>
                      <td>{{ p.ties }}</td>
                      <td>{{ p.pct }}%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>

    <div v-else class="container text-center mt-5">
      <div class="spinner-border" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
    </div>
  `,
});
