import { Meteor } from 'meteor/meteor';
import { defineComponent, ref, computed } from 'vue';
import { useTracker, useSubscribe } from '../composables';
import { Players, Matches } from '../../api/collections';

export default defineComponent({
  name: 'AddMatch',
  setup() {
    useSubscribe('players');
    useSubscribe('matches');

    const ro = ref('');
    const rd = ref('');
    const bo = ref('');
    const bd = ref('');
    const rs = ref('');
    const bs = ref('');
    const errorMsg = ref('');
    const successMsg = ref('');

    const playerNames = useTracker(() => {
      return Players.find({}).fetch().map((p) => p.name);
    });

    const winStats = useTracker(() => {
      const matches = Matches.find({}).fetch();
      let redSinglesWins = 0;
      let redDoublesWins = 0;
      let blueSinglesWins = 0;
      let blueDoublesWins = 0;

      matches.forEach((m) => {
        const redWon = parseInt(m.rs, 10) > parseInt(m.bs, 10);
        const blueWon = !redWon;

        if (m.ro_id && !m.rd_id && redWon) redSinglesWins++;
        if (m.ro_id && m.rd_id && redWon) redDoublesWins++;
        if (m.bo_id && !m.bd_id && blueWon) blueSinglesWins++;
        if (m.bo_id && m.bd_id && blueWon) blueDoublesWins++;
      });

      return { redSinglesWins, redDoublesWins, blueSinglesWins, blueDoublesWins };
    });

    const recentMatches = useTracker(() => {
      return Matches.find({}, { sort: { date_time: -1 }, limit: 10 }).fetch().map((m) => {
        const findPlayer = (id) => {
          if (!id) return 'N/A';
          const p = Players.findOne({ _id: id });
          return p ? p.name : 'N/A';
        };

        const dt = new Date(m.date_time);
        return {
          _id: m._id,
          dateTime: dt.toLocaleString(),
          roName: findPlayer(m.ro_id),
          rdName: findPlayer(m.rd_id),
          boName: findPlayer(m.bo_id),
          bdName: findPlayer(m.bd_id),
          rs: m.rs,
          bs: m.bs,
        };
      });
    });

    async function submitMatch() {
      errorMsg.value = '';
      successMsg.value = '';

      if (!ro.value || !bo.value || rs.value === '' || bs.value === '') {
        errorMsg.value = 'Offense players and scores are required.';
        return;
      }

      const scoreR = parseInt(rs.value, 10);
      const scoreB = parseInt(bs.value, 10);

      if (isNaN(scoreR) || isNaN(scoreB) || scoreR < 0 || scoreR > 10 || scoreB < 0 || scoreB > 10) {
        errorMsg.value = 'Scores must be between 0 and 10.';
        return;
      }

      if (scoreR === scoreB) {
        errorMsg.value = 'Scores cannot be tied.';
        return;
      }

      const doc = { ro: ro.value, bo: bo.value, rs: scoreR, bs: scoreB };
      if (rd.value) doc.rd = rd.value;
      if (bd.value) doc.bd = bd.value;

      try {
        await Meteor.callAsync('add_match', doc);
        successMsg.value = 'Match recorded!';
        ro.value = '';
        rd.value = '';
        bo.value = '';
        bd.value = '';
        rs.value = '';
        bs.value = '';
      } catch (err) {
        errorMsg.value = err.reason || err.message;
      }
    }

    return { ro, rd, bo, bd, rs, bs, errorMsg, successMsg, playerNames, winStats, recentMatches, submitMatch };
  },
  template: `
    <div class="container">
      <div class="row justify-content-center">
        <div class="col-lg-8">
          <h3 class="text-center mb-3">Add Match</h3>

          <div v-if="errorMsg" class="alert alert-danger">{{ errorMsg }}</div>
          <div v-if="successMsg" class="alert alert-success">{{ successMsg }}</div>

          <form @submit.prevent="submitMatch">
            <div class="row">
              <!-- Red/Yellow Team -->
              <div class="col-sm-6">
                <h5>
                  <span style="color: red">Red</span> / <span style="color: goldenrod">Yellow</span>
                  <small class="text-muted">({{ winStats.redSinglesWins }} / {{ winStats.redDoublesWins }})</small>
                </h5>
                <div class="mb-3">
                  <label class="form-label">Offense *</label>
                  <input v-model="ro" type="text" class="form-control" list="player-list" required>
                </div>
                <div class="mb-3">
                  <label class="form-label">Defense</label>
                  <input v-model="rd" type="text" class="form-control" list="player-list">
                </div>
              </div>

              <!-- Blue/Black Team -->
              <div class="col-sm-6">
                <h5>
                  <span style="color: blue">Blue</span> / <span style="color: black">Black</span>
                  <small class="text-muted">({{ winStats.blueSinglesWins }} / {{ winStats.blueDoublesWins }})</small>
                </h5>
                <div class="mb-3">
                  <label class="form-label">Offense *</label>
                  <input v-model="bo" type="text" class="form-control" list="player-list" required>
                </div>
                <div class="mb-3">
                  <label class="form-label">Defense</label>
                  <input v-model="bd" type="text" class="form-control" list="player-list">
                </div>
              </div>
            </div>

            <datalist id="player-list">
              <option v-for="name in playerNames" :key="name" :value="name" />
            </datalist>

            <hr>
            <h5 class="text-center">Score</h5>
            <div class="row">
              <div class="col-sm-6">
                <div class="mb-3">
                  <label class="form-label">Red/Yellow Score *</label>
                  <input v-model="rs" type="number" class="form-control" min="0" max="10" required>
                </div>
              </div>
              <div class="col-sm-6">
                <div class="mb-3">
                  <label class="form-label">Blue/Black Score *</label>
                  <input v-model="bs" type="number" class="form-control" min="0" max="10" required>
                </div>
              </div>
            </div>

            <div class="text-center">
              <button type="submit" class="btn btn-primary">Submit</button>
            </div>
          </form>

          <hr>
          <h4 class="text-center">Recent Matches</h4>
          <div class="table-responsive">
            <table class="table table-striped table-hover">
              <thead>
                <tr>
                  <th>Date/Time</th>
                  <th class="d-none d-md-table-cell">R Off</th>
                  <th class="d-none d-md-table-cell">R Def</th>
                  <th class="d-none d-md-table-cell">B Off</th>
                  <th class="d-none d-md-table-cell">B Def</th>
                  <th>R</th>
                  <th>B</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="m in recentMatches" :key="m._id">
                  <td>{{ m.dateTime }}</td>
                  <td class="d-none d-md-table-cell">{{ m.roName }}</td>
                  <td class="d-none d-md-table-cell">{{ m.rdName }}</td>
                  <td class="d-none d-md-table-cell">{{ m.boName }}</td>
                  <td class="d-none d-md-table-cell">{{ m.bdName }}</td>
                  <td>{{ m.rs }}</td>
                  <td>{{ m.bs }}</td>
                </tr>
                <tr v-if="recentMatches.length === 0">
                  <td colspan="7" class="text-center text-muted">No matches yet</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `,
});
