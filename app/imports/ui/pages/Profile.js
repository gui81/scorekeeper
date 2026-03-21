import { Meteor } from 'meteor/meteor';
import { defineComponent, ref } from 'vue';
import { useUser } from '../composables';

export default defineComponent({
  name: 'Profile',
  setup() {
    const user = useUser();
    const newName = ref('');
    const errorMsg = ref('');
    const successMsg = ref('');
    const loading = ref(false);

    function initName() {
      if (user.value) {
        newName.value = user.value.profile?.name || '';
      }
    }

    // Initialize once user data is available
    const stop = setInterval(() => {
      if (user.value) {
        initName();
        clearInterval(stop);
      }
    }, 100);

    async function updateName() {
      errorMsg.value = '';
      successMsg.value = '';

      if (!newName.value.trim()) {
        errorMsg.value = 'Display name is required.';
        return;
      }

      loading.value = true;
      try {
        await Meteor.callAsync('update_profile_name', { name: newName.value.trim() });
        successMsg.value = 'Name updated successfully.';
      } catch (err) {
        errorMsg.value = err.reason || err.message;
      } finally {
        loading.value = false;
      }
    }

    function userEmail() {
      return user.value?.emails?.[0]?.address || '';
    }

    return { user, newName, errorMsg, successMsg, loading, updateName, userEmail };
  },
  template: `
    <div class="container">
      <div class="row justify-content-center">
        <div class="col-md-6">
          <h3 class="text-center mb-4">Profile</h3>

          <div v-if="errorMsg" class="alert alert-danger">{{ errorMsg }}</div>
          <div v-if="successMsg" class="alert alert-success">{{ successMsg }}</div>

          <div class="card">
            <div class="card-body">
              <div class="mb-3">
                <label class="form-label fw-bold">Email</label>
                <input type="email" class="form-control" :value="userEmail()" disabled>
              </div>
              <form @submit.prevent="updateName">
                <div class="mb-3">
                  <label class="form-label fw-bold">Display Name</label>
                  <input v-model="newName" type="text" class="form-control" placeholder="Your display name" required>
                </div>
                <button type="submit" class="btn btn-primary" :disabled="loading">
                  Save Changes
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
});
