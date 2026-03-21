import { Meteor } from 'meteor/meteor';
import { defineComponent, ref } from 'vue';
import { useTracker, useSubscribe, useActiveOrg } from '../composables';
import { Organizations, OrganizationMembers } from '../../api/organizations';

export default defineComponent({
  name: 'OrganizationSelect',
  setup() {
    useSubscribe('user_organizations');

    const { setActiveOrg } = useActiveOrg();
    const newOrgName = ref('');
    const inviteCode = ref('');
    const errorMsg = ref('');
    const successMsg = ref('');

    const userOrgs = useTracker(() => {
      const memberships = OrganizationMembers.find({ user_id: Meteor.userId() }).fetch();
      return memberships.map((m) => {
        const org = Organizations.findOne(m.org_id);
        return {
          _id: m.org_id,
          name: org ? org.name : 'Loading...',
          role: m.role,
        };
      });
    });

    async function createOrg() {
      errorMsg.value = '';
      successMsg.value = '';
      if (newOrgName.value.trim().length < 2) {
        errorMsg.value = 'Organization name must be at least 2 characters.';
        return;
      }
      try {
        const orgId = await Meteor.callAsync('create_organization', { name: newOrgName.value });
        successMsg.value = `Organization "${newOrgName.value}" created!`;
        newOrgName.value = '';
        setActiveOrg(orgId);
      } catch (err) {
        errorMsg.value = err.reason || err.message;
      }
    }

    async function joinOrg() {
      errorMsg.value = '';
      successMsg.value = '';
      if (!inviteCode.value.trim()) {
        errorMsg.value = 'Please enter an invite code.';
        return;
      }
      try {
        const orgId = await Meteor.callAsync('accept_invite', { token: inviteCode.value.trim() });
        successMsg.value = 'Successfully joined the organization!';
        inviteCode.value = '';
        setActiveOrg(orgId);
      } catch (err) {
        errorMsg.value = err.reason || err.message;
      }
    }

    function selectOrg(orgId) {
      setActiveOrg(orgId);
    }

    return {
      userOrgs,
      newOrgName,
      inviteCode,
      errorMsg,
      successMsg,
      createOrg,
      joinOrg,
      selectOrg,
    };
  },
  template: `
    <div class="container">
      <div class="row justify-content-center">
        <div class="col-md-6">
          <h3 class="text-center mb-4">Select Organization</h3>

          <div v-if="errorMsg" class="alert alert-danger">{{ errorMsg }}</div>
          <div v-if="successMsg" class="alert alert-success">{{ successMsg }}</div>

          <!-- Existing orgs -->
          <div v-if="userOrgs.length > 0" class="mb-4">
            <h5>Your Organizations</h5>
            <div class="list-group">
              <button v-for="org in userOrgs" :key="org._id"
                      class="list-group-item list-group-item-action d-flex justify-content-between align-items-center"
                      @click="selectOrg(org._id)">
                <span>{{ org.name }}</span>
                <span class="badge bg-secondary">{{ org.role }}</span>
              </button>
            </div>
          </div>

          <hr v-if="userOrgs.length > 0">

          <!-- Create new org -->
          <div class="card mb-3">
            <div class="card-body">
              <h5 class="card-title">Create Organization</h5>
              <form @submit.prevent="createOrg" class="d-flex gap-2">
                <input v-model="newOrgName" type="text" class="form-control" placeholder="Organization name" minlength="2">
                <button type="submit" class="btn btn-primary text-nowrap">Create</button>
              </form>
            </div>
          </div>

          <!-- Join via invite code -->
          <div class="card">
            <div class="card-body">
              <h5 class="card-title">Join with Invite Code</h5>
              <form @submit.prevent="joinOrg" class="d-flex gap-2">
                <input v-model="inviteCode" type="text" class="form-control" placeholder="Paste invite code">
                <button type="submit" class="btn btn-outline-primary text-nowrap">Join</button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
});
