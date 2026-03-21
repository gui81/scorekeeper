import { defineComponent, ref, onMounted, onUnmounted, watch } from 'vue';
import { Chart, registerables } from 'chart.js';
import { useTracker, useSubscribe, useActiveOrg } from '../composables';
import {
  Players,
  CombinedRatings,
  SinglesRatings,
  OffenseRatings,
  DefenseRatings,
} from '../../api/collections';

Chart.register(...registerables);

function getChartData(collection, orgId) {
  const players = Players.find({ org_id: orgId }).fetch();
  const playerRatings = [];

  players.forEach((player) => {
    const rating = collection.findOne({ player_id: player._id }, { sort: { date_time: -1 } });
    if (rating) {
      playerRatings.push({ playerId: player._id, playerName: player.name, rating: rating.rating });
    }
  });

  playerRatings.sort((a, b) => b.rating - a.rating);
  playerRatings.length = Math.min(playerRatings.length, 10);

  const datasets = [];

  playerRatings.forEach((pr) => {
    const ratings = collection.find({ player_id: pr.playerId }, { sort: { date_time: 1 } }).fetch();
    const data = ratings.map((r) => ({ x: r.date_time, y: r.rating }));
    datasets.push({
      label: pr.playerName,
      data,
      fill: false,
      tension: 0.2,
    });
  });

  return { datasets };
}

function createChart(canvas, collection, title, orgId) {
  const data = getChartData(collection, orgId);
  return new Chart(canvas, {
    type: 'line',
    data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: { display: true, text: title, font: { size: 16 } },
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

export default defineComponent({
  name: 'Home',
  setup() {
    const { activeOrgId } = useActiveOrg();

    const playersReady = useSubscribe('players', activeOrgId.value);
    const combinedReady = useSubscribe('combined_ratings', activeOrgId.value);
    const singlesReady = useSubscribe('singles_ratings', activeOrgId.value);
    const offenseReady = useSubscribe('offense_ratings', activeOrgId.value);
    const defenseReady = useSubscribe('defense_ratings', activeOrgId.value);

    const combinedCanvas = ref(null);
    const singlesCanvas = ref(null);
    const offenseCanvas = ref(null);
    const defenseCanvas = ref(null);

    const charts = [];
    const mounted = ref(false);

    function buildCharts() {
      charts.forEach((c) => c.destroy());
      charts.length = 0;

      if (combinedCanvas.value) {
        charts.push(
          createChart(combinedCanvas.value, CombinedRatings, 'Combined Rating', activeOrgId.value),
        );
      }
      if (singlesCanvas.value) {
        charts.push(
          createChart(singlesCanvas.value, SinglesRatings, 'Singles Rating', activeOrgId.value),
        );
      }
      if (offenseCanvas.value) {
        charts.push(
          createChart(
            offenseCanvas.value,
            OffenseRatings,
            'Doubles Offense Rating',
            activeOrgId.value,
          ),
        );
      }
      if (defenseCanvas.value) {
        charts.push(
          createChart(
            defenseCanvas.value,
            DefenseRatings,
            'Doubles Defense Rating',
            activeOrgId.value,
          ),
        );
      }
    }

    onMounted(() => {
      mounted.value = true;
    });

    // Build charts when subscriptions are ready and DOM is mounted
    watch(
      [mounted, playersReady, combinedReady, singlesReady, offenseReady, defenseReady],
      ([m, p, c, s, o, d]) => {
        if (m && p && c && s && o && d) {
          buildCharts();
        }
      },
    );

    // Also rebuild when underlying data changes (e.g. new match added)
    const dataVersion = useTracker(() => {
      const playerIds = Players.find({ org_id: activeOrgId.value })
        .fetch()
        .map((p) => p._id);
      return {
        players: playerIds.length,
        combined: CombinedRatings.find({ player_id: { $in: playerIds } }).count(),
      };
    });

    watch(
      dataVersion,
      () => {
        if (mounted.value) buildCharts();
      },
      { deep: true },
    );

    onUnmounted(() => {
      charts.forEach((c) => c.destroy());
    });

    return {
      combinedCanvas,
      singlesCanvas,
      offenseCanvas,
      defenseCanvas,
    };
  },
  template: `
    <div class="container-fluid">
      <div class="chart-container mb-4" style="position: relative; height: 400px;">
        <canvas ref="combinedCanvas"></canvas>
      </div>
      <div class="chart-container mb-4" style="position: relative; height: 400px;">
        <canvas ref="singlesCanvas"></canvas>
      </div>
      <div class="chart-container mb-4" style="position: relative; height: 400px;">
        <canvas ref="offenseCanvas"></canvas>
      </div>
      <div class="chart-container mb-4" style="position: relative; height: 400px;">
        <canvas ref="defenseCanvas"></canvas>
      </div>
    </div>
  `,
});
