import { Meteor } from 'meteor/meteor';
import { defineComponent, ref, computed } from 'vue';
import { useUser, useTracker, useSubscribe } from '../composables';
import { Organizations, OrganizationMembers } from '../../api/organizations';

export default defineComponent({
  name: 'Profile',
  setup() {
    const user = useUser();
    const newName = ref('');
    const defaultOrgId = ref('');
    const errorMsg = ref('');
    const successMsg = ref('');
    const loading = ref(false);

    useSubscribe('user_organizations');

    const userOrgs = useTracker(() => {
      if (!Meteor.userId()) return [];
      const memberships = OrganizationMembers.find({ user_id: Meteor.userId() }).fetch();
      return memberships.map((m) => {
        const org = Organizations.findOne(m.org_id);
        return { _id: m.org_id, name: org ? org.name : '...' };
      });
    });

    const hasOrgs = computed(() => userOrgs.value.length > 0);

    function initFields() {
      if (user.value) {
        newName.value = user.value.profile?.name || '';
        defaultOrgId.value = user.value.profile?.default_org_id || '';
      }
    }

    // Initialize once user data is available
    const stop = setInterval(() => {
      if (user.value) {
        initFields();
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

    async function updateDefaultOrg() {
      errorMsg.value = '';
      successMsg.value = '';
      loading.value = true;
      try {
        await Meteor.callAsync('set_default_org', {
          org_id: defaultOrgId.value || null,
        });
        successMsg.value = 'Default organization updated.';
      } catch (err) {
        errorMsg.value = err.reason || err.message;
      } finally {
        loading.value = false;
      }
    }

    function userEmail() {
      return user.value?.emails?.[0]?.address || '';
    }

    return {
      user,
      newName,
      defaultOrgId,
      userOrgs,
      hasOrgs,
      errorMsg,
      successMsg,
      loading,
      updateName,
      updateDefaultOrg,
      userEmail,
    };
  },
  template: `
    <div class="container">
      <div class="row justify-content-center">
        <div class="col-md-6">
          <h3 class="text-center mb-4">Profile</h3>

          <div v-if="errorMsg" class="alert alert-danger">{{ errorMsg }}</div>
          <div v-if="successMsg" class="alert alert-success">{{ successMsg }}</div>

          <div class="card mb-4">
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
                  Save Name
                </button>
              </form>
            </div>
          </div>

          <div v-if="hasOrgs" class="card">
            <div class="card-header fw-bold">Default Organization</div>
            <div class="card-body">
              <p class="text-muted small">Choose which organization to load automatically when you sign in.</p>
              <form @submit.prevent="updateDefaultOrg">
                <div class="mb-3">
                  <select v-model="defaultOrgId" class="form-select">
                    <option value="">None (show selection page)</option>
                    <option v-for="org in userOrgs" :key="org._id" :value="org._id">{{ org.name }}</option>
                  </select>
                </div>
                <button type="submit" class="btn btn-primary" :disabled="loading">
                  Save Default
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
});
