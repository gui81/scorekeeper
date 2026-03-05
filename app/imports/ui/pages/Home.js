import { defineComponent, ref, onUnmounted, watch } from 'vue';
import { Chart, registerables } from 'chart.js';
import { useTracker, useSubscribe } from '../composables';
import {
  Players,
  CombinedRatings,
  SinglesRatings,
  OffenseRatings,
  DefenseRatings,
} from '../../api/collections';

Chart.register(...registerables);

function getChartData(collection) {
  const players = Players.find({}).fetch();
  const playerRatings = [];

  players.forEach((player) => {
    const rating = collection.findOne({ player_id: player._id }, { sort: { date_time: -1 } });
    if (rating) {
      playerRatings.push({ playerId: player._id, playerName: player.name, rating: rating.rating });
    }
  });

  playerRatings.sort((a, b) => b.rating - a.rating);
  playerRatings.length = Math.min(playerRatings.length, 10);

  const labels = new Set();
  const datasets = [];

  playerRatings.forEach((pr) => {
    const ratings = collection.find({ player_id: pr.playerId }, { sort: { date_time: 1 } }).fetch();
    const data = ratings.map((r) => ({ x: r.date_time, y: r.rating }));
    data.forEach((d) => labels.add(d.x));
    datasets.push({
      label: pr.playerName,
      data,
      fill: false,
      tension: 0.2,
    });
  });

  return { datasets };
}

function createChart(canvas, collection, title) {
  const data = getChartData(collection);
  return new Chart(canvas, {
    type: 'line',
    data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: { display: true, text: title, font: { size: 16 } },
        legend: { position: 'bottom' },
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
    useSubscribe('players');
    useSubscribe('combined_ratings');
    useSubscribe('singles_ratings');
    useSubscribe('offense_ratings');
    useSubscribe('defense_ratings');

    const combinedCanvas = ref(null);
    const singlesCanvas = ref(null);
    const offenseCanvas = ref(null);
    const defenseCanvas = ref(null);

    const charts = [];

    // Use a tracker to detect when data changes
    const dataVersion = useTracker(() => {
      return {
        players: Players.find({}).count(),
        combined: CombinedRatings.find({}).count(),
        singles: SinglesRatings.find({}).count(),
        offense: OffenseRatings.find({}).count(),
        defense: DefenseRatings.find({}).count(),
      };
    });

    function buildCharts() {
      // Destroy existing charts
      charts.forEach((c) => c.destroy());
      charts.length = 0;

      if (combinedCanvas.value) {
        charts.push(createChart(combinedCanvas.value, CombinedRatings, 'Combined Rating'));
      }
      if (singlesCanvas.value) {
        charts.push(createChart(singlesCanvas.value, SinglesRatings, 'Singles Rating'));
      }
      if (offenseCanvas.value) {
        charts.push(createChart(offenseCanvas.value, OffenseRatings, 'Doubles Offense Rating'));
      }
      if (defenseCanvas.value) {
        charts.push(createChart(defenseCanvas.value, DefenseRatings, 'Doubles Defense Rating'));
      }
    }

    watch(
      dataVersion,
      () => {
        if (combinedCanvas.value) {
          buildCharts();
        }
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
