import { defineComponent, ref, computed } from 'vue';
import { useTracker, useSubscribe, useActiveOrg } from '../composables';
import {
  Players,
  Matches,
  CombinedRatings,
  SinglesRatings,
  OffenseRatings,
  DefenseRatings,
} from '../../api/collections';

function getLatestRating(playerId, collection) {
  const rating = collection.findOne({ player_id: playerId }, { sort: { date_time: -1 } });
  return rating ? Math.round(rating.rating) : 'N/A';
}

export default defineComponent({
  name: 'IndividualStats',
  setup() {
    const { activeOrgId } = useActiveOrg();

    useSubscribe('matches', activeOrgId.value);
    useSubscribe('players', activeOrgId.value);
    useSubscribe('combined_ratings', activeOrgId.value);
    useSubscribe('singles_ratings', activeOrgId.value);
    useSubscribe('offense_ratings', activeOrgId.value);
    useSubscribe('defense_ratings', activeOrgId.value);

    const sortColumn = ref('combined');
    const sortAsc = ref(false);
    const currentPage = ref(1);
    const perPage = 10;

    const stats = useTracker(() => {
      const matches = Matches.find({ org_id: activeOrgId.value }).fetch();
      const players = {};

      matches.forEach((match) => {
        const redWin = parseInt(match.rs, 10) > parseInt(match.bs, 10) ? 1 : 0;
        const blueWin = redWin ? 0 : 1;

        const addPlayer = (id, win, loss) => {
          if (!id) return;
          if (!players[id]) players[id] = { wins: 0, losses: 0 };
          players[id].wins += win;
          players[id].losses += loss;
        };

        addPlayer(match.ro_id, redWin, blueWin);
        addPlayer(match.rd_id, redWin, blueWin);
        addPlayer(match.bo_id, blueWin, redWin);
        addPlayer(match.bd_id, blueWin, redWin);
      });

      const result = [];
      for (const id in players) {
        const player = Players.findOne({ _id: id });
        if (!player) continue;

        const total = players[id].wins + players[id].losses;
        result.push({
          id,
          name: player.name,
          wins: players[id].wins,
          losses: players[id].losses,
          percent: total > 0 ? Math.round((players[id].wins / total) * 100) : 0,
          combined: getLatestRating(id, CombinedRatings),
          singles: getLatestRating(id, SinglesRatings),
          offense: getLatestRating(id, OffenseRatings),
          defense: getLatestRating(id, DefenseRatings),
        });
      }

      return result;
    });

    const sortedStats = computed(() => {
      const col = sortColumn.value;
      const asc = sortAsc.value;
      const data = [...stats.value];

      data.sort((a, b) => {
        let aVal = a[col];
        let bVal = b[col];
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          return asc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        }
        if (aVal === 'N/A') aVal = -Infinity;
        if (bVal === 'N/A') bVal = -Infinity;
        return asc ? aVal - bVal : bVal - aVal;
      });

      return data;
    });

    const totalPages = computed(() => Math.max(1, Math.ceil(sortedStats.value.length / perPage)));

    const paginatedStats = computed(() => {
      const start = (currentPage.value - 1) * perPage;
      return sortedStats.value.slice(start, start + perPage);
    });

    function toggleSort(col) {
      if (sortColumn.value === col) {
        sortAsc.value = !sortAsc.value;
      } else {
        sortColumn.value = col;
        sortAsc.value = false;
      }
      currentPage.value = 1;
    }

    function sortIndicator(col) {
      if (sortColumn.value !== col) return '';
      return sortAsc.value ? ' ▲' : ' ▼';
    }

    return { paginatedStats, currentPage, totalPages, toggleSort, sortIndicator };
  },
  template: `
    <div class="container">
      <div class="row justify-content-center">
        <div class="col-lg-10">
          <h2 class="text-center mb-3">Individual Stats</h2>
          <div class="table-responsive">
            <table class="table table-striped table-hover">
              <thead>
                <tr>
                  <th role="button" @click="toggleSort('name')">Name{{ sortIndicator('name') }}</th>
                  <th role="button" class="d-none d-md-table-cell" @click="toggleSort('wins')">Wins{{ sortIndicator('wins') }}</th>
                  <th role="button" class="d-none d-md-table-cell" @click="toggleSort('losses')">Losses{{ sortIndicator('losses') }}</th>
                  <th role="button" class="d-none d-md-table-cell" @click="toggleSort('percent')">Win %{{ sortIndicator('percent') }}</th>
                  <th role="button" class="d-none d-md-table-cell" @click="toggleSort('singles')">Singles{{ sortIndicator('singles') }}</th>
                  <th role="button" class="d-none d-md-table-cell" @click="toggleSort('offense')">Offense{{ sortIndicator('offense') }}</th>
                  <th role="button" class="d-none d-md-table-cell" @click="toggleSort('defense')">Defense{{ sortIndicator('defense') }}</th>
                  <th role="button" @click="toggleSort('combined')">Combined{{ sortIndicator('combined') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="s in paginatedStats" :key="s.id">
                  <td><router-link :to="'/player/' + s.id">{{ s.name }}</router-link></td>
                  <td class="d-none d-md-table-cell">{{ s.wins }}</td>
                  <td class="d-none d-md-table-cell">{{ s.losses }}</td>
                  <td class="d-none d-md-table-cell">{{ s.percent }}%</td>
                  <td class="d-none d-md-table-cell">{{ s.singles }}</td>
                  <td class="d-none d-md-table-cell">{{ s.offense }}</td>
                  <td class="d-none d-md-table-cell">{{ s.defense }}</td>
                  <td>{{ s.combined }}</td>
                </tr>
                <tr v-if="paginatedStats.length === 0">
                  <td colspan="8" class="text-center text-muted">No stats available</td>
                </tr>
              </tbody>
            </table>
          </div>

          <nav v-if="totalPages > 1" aria-label="Stats pagination">
            <ul class="pagination justify-content-center">
              <li class="page-item" :class="{ disabled: currentPage === 1 }">
                <a class="page-link" href="#" @click.prevent="currentPage--">Previous</a>
              </li>
              <li v-for="p in totalPages" :key="p" class="page-item" :class="{ active: currentPage === p }">
                <a class="page-link" href="#" @click.prevent="currentPage = p">{{ p }}</a>
              </li>
              <li class="page-item" :class="{ disabled: currentPage === totalPages }">
                <a class="page-link" href="#" @click.prevent="currentPage++">Next</a>
              </li>
            </ul>
          </nav>
        </div>
      </div>
    </div>
  `,
});
