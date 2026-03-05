import { Meteor } from 'meteor/meteor';
import { defineComponent, ref } from 'vue';
import { useTracker, useSubscribe } from '../composables';
import { Players, CombinedRatings } from '../../api/collections';

export default defineComponent({
  name: 'AddPlayer',
  setup() {
    useSubscribe('players');
    useSubscribe('combined_ratings');

    const playerName = ref('');
    const rating = ref(1250);
    const errorMsg = ref('');
    const successMsg = ref('');

    const ratingOptions = [
      { value: 250, label: 'Novice (250)' },
      { value: 750, label: 'Novice-Elite (750)' },
      { value: 1250, label: 'Expert (1250)' },
      { value: 1750, label: 'Expert-Elite (1750)' },
      { value: 2250, label: 'Master (2250)' },
    ];

    const recentPlayers = useTracker(() => {
      return Players.find({}, { sort: { date_time: -1 }, limit: 10 })
        .fetch()
        .map((p) => {
          const eloRating = CombinedRatings.findOne(
            { player_id: p._id },
            { sort: { date_time: 1 } },
          );
          return {
            _id: p._id,
            name: p.name,
            initialRating: eloRating ? Math.round(eloRating.rating) : 'N/A',
          };
        });
    });

    async function submitPlayer() {
      errorMsg.value = '';
      successMsg.value = '';

      if (playerName.value.length < 2) {
        errorMsg.value = 'Player name must be at least 2 characters.';
        return;
      }

      try {
        await Meteor.callAsync('add_player', {
          playername: playerName.value,
          rating: rating.value,
        });
        successMsg.value = `Player "${playerName.value}" added successfully!`;
        playerName.value = '';
        rating.value = 1250;
      } catch (err) {
        errorMsg.value = err.reason || err.message;
      }
    }

    return { playerName, rating, ratingOptions, errorMsg, successMsg, recentPlayers, submitPlayer };
  },
  template: `
    <div class="container">
      <div class="row justify-content-center">
        <div class="col-md-6">
          <h3 class="text-center mb-3">Add Player</h3>

          <div v-if="errorMsg" class="alert alert-danger">{{ errorMsg }}</div>
          <div v-if="successMsg" class="alert alert-success">{{ successMsg }}</div>

          <form @submit.prevent="submitPlayer">
            <div class="mb-3">
              <label class="form-label">Name *</label>
              <input v-model="playerName" type="text" class="form-control" required minlength="2">
            </div>
            <div class="mb-3">
              <label class="form-label">Initial Rating *</label>
              <select v-model="rating" class="form-select">
                <option v-for="opt in ratingOptions" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </option>
              </select>
            </div>
            <div class="mb-3 text-start small">
              Novice = 250 &middot; Novice-Elite = 750 &middot; Expert = 1250<br>
              Expert-Elite = 1750 &middot; Master = 2250
            </div>
            <div class="text-center">
              <button type="submit" class="btn btn-primary">Submit</button>
            </div>
          </form>

          <hr>

          <h4 class="text-center">Recently Added Players</h4>
          <div class="table-responsive">
            <table class="table table-striped table-hover">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Elo Rating</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="player in recentPlayers" :key="player._id">
                  <td><router-link :to="'/player/' + player._id">{{ player.name }}</router-link></td>
                  <td>{{ player.initialRating }}</td>
                </tr>
                <tr v-if="recentPlayers.length === 0">
                  <td colspan="2" class="text-center text-muted">No players yet</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `,
});
