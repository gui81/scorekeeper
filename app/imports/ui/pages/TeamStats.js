import { defineComponent, ref, computed } from 'vue';
import { useTracker, useSubscribe, useActiveOrg } from '../composables';
import { Players, Matches, TeamRatings } from '../../api/collections';

function getLatestTeamRating(offenseId, defenseId) {
  const rating = TeamRatings.findOne(
    { offense_id: offenseId, defense_id: defenseId },
    { sort: { date_time: -1 } },
  );
  return rating ? Math.round(rating.rating) : 'N/A';
}

export default defineComponent({
  name: 'TeamStats',
  setup() {
    const { activeOrgId } = useActiveOrg();

    useSubscribe('matches', activeOrgId.value);
    useSubscribe('players', activeOrgId.value);
    useSubscribe('team_ratings', activeOrgId.value);

    const sortColumn = ref('rating');
    const sortAsc = ref(false);
    const currentPage = ref(1);
    const perPage = 10;

    const stats = useTracker(() => {
      const matches = Matches.find({ org_id: activeOrgId.value }).fetch();
      const teams = {};

      matches.forEach((match) => {
        const r = parseInt(match.rs, 10);
        const b = parseInt(match.bs, 10);
        const redWin = r > b ? 1 : 0;
        const blueWin = b > r ? 1 : 0;
        const tie = r === b ? 1 : 0;

        const addTeam = (oId, dId, win, loss, draw) => {
          if (!oId || !dId) return;
          const key = oId + '|' + dId;
          if (!teams[key]) teams[key] = { oId, dId, wins: 0, losses: 0, ties: 0 };
          teams[key].wins += win;
          teams[key].losses += loss;
          teams[key].ties += draw;
        };

        addTeam(match.ro_id, match.rd_id, redWin, blueWin, tie);
        addTeam(match.bo_id, match.bd_id, blueWin, redWin, tie);
      });

      const result = [];
      for (const key in teams) {
        const t = teams[key];
        const oPlayer = Players.findOne({ _id: t.oId });
        const dPlayer = Players.findOne({ _id: t.dId });
        if (!oPlayer || !dPlayer) continue;

        const total = t.wins + t.losses + t.ties;
        result.push({
          key,
          offPlayer: oPlayer.name,
          defPlayer: dPlayer.name,
          wins: t.wins,
          losses: t.losses,
          ties: t.ties,
          percent: total > 0 ? Math.round(((t.wins + 0.5 * t.ties) / total) * 100) : 0,
          rating: getLatestTeamRating(t.oId, t.dId),
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
          <h2 class="text-center mb-3">Team Stats</h2>
          <div class="table-responsive">
            <table class="table table-striped table-hover">
              <thead>
                <tr>
                  <th role="button" @click="toggleSort('offPlayer')">Offense{{ sortIndicator('offPlayer') }}</th>
                  <th role="button" @click="toggleSort('defPlayer')">Defense{{ sortIndicator('defPlayer') }}</th>
                  <th role="button" class="d-none d-md-table-cell" @click="toggleSort('wins')">Wins{{ sortIndicator('wins') }}</th>
                  <th role="button" class="d-none d-md-table-cell" @click="toggleSort('losses')">Losses{{ sortIndicator('losses') }}</th>
                  <th role="button" class="d-none d-md-table-cell" @click="toggleSort('ties')">Ties{{ sortIndicator('ties') }}</th>
                  <th role="button" class="d-none d-md-table-cell" @click="toggleSort('percent')">Win %{{ sortIndicator('percent') }}</th>
                  <th role="button" @click="toggleSort('rating')">Rating{{ sortIndicator('rating') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="t in paginatedStats" :key="t.key">
                  <td>{{ t.offPlayer }}</td>
                  <td>{{ t.defPlayer }}</td>
                  <td class="d-none d-md-table-cell">{{ t.wins }}</td>
                  <td class="d-none d-md-table-cell">{{ t.losses }}</td>
                  <td class="d-none d-md-table-cell">{{ t.ties }}</td>
                  <td class="d-none d-md-table-cell">{{ t.percent }}%</td>
                  <td>{{ t.rating }}</td>
                </tr>
                <tr v-if="paginatedStats.length === 0">
                  <td colspan="7" class="text-center text-muted">No team stats available</td>
                </tr>
              </tbody>
            </table>
          </div>

          <nav v-if="totalPages > 1" aria-label="Team stats pagination">
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
