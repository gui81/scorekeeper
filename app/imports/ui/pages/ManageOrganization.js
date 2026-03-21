import { Meteor } from 'meteor/meteor';
import { defineComponent, ref, computed, onUnmounted } from 'vue';
import { useTracker, useSubscribe, useActiveOrg } from '../composables';
import { Organizations, OrganizationMembers, OrganizationInvites } from '../../api/organizations';
import { Players, CombinedRatings } from '../../api/collections';

function getUserDisplayName(user) {
  if (!user) return 'Loading...';
  if (user.profile?.name) return user.profile.name;
  if (user.emails?.length) return user.emails[0].address;
  return user._id;
}

export default defineComponent({
  name: 'ManageOrganization',
  setup() {
    const { activeOrgId, setActiveOrg } = useActiveOrg();

    useSubscribe('user_organizations');
    useSubscribe('organization_members', activeOrgId.value);
    useSubscribe('organization_invites', activeOrgId.value);
    useSubscribe('players', activeOrgId.value);

    // Manage combined_ratings subscription so we can refresh after adding a guest player
    let ratingsSubHandle = Meteor.subscribe('combined_ratings', activeOrgId.value);
    onUnmounted(() => {
      if (ratingsSubHandle) ratingsSubHandle.stop();
    });

    function refreshRatings() {
      if (ratingsSubHandle) ratingsSubHandle.stop();
      ratingsSubHandle = Meteor.subscribe('combined_ratings', activeOrgId.value);
    }

    const errorMsg = ref('');
    const successMsg = ref('');
    const inviteLink = ref('');

    // Guest player form
    const guestName = ref('');
    const guestRating = ref(1250);
    const ratingOptions = [
      { value: 250, label: 'Novice (250)' },
      { value: 750, label: 'Novice-Elite (750)' },
      { value: 1250, label: 'Expert (1250)' },
      { value: 1750, label: 'Expert-Elite (1750)' },
      { value: 2250, label: 'Master (2250)' },
    ];

    const org = useTracker(() => {
      return Organizations.findOne(activeOrgId.value);
    });

    const currentMember = useTracker(() => {
      return OrganizationMembers.findOne({
        org_id: activeOrgId.value,
        user_id: Meteor.userId(),
      });
    });

    const isOwner = computed(() => currentMember.value?.role === 'owner');
    const isOwnerOrMaintainer = computed(
      () => currentMember.value && ['owner', 'maintainer'].includes(currentMember.value.role),
    );

    const members = useTracker(() => {
      return OrganizationMembers.find({ org_id: activeOrgId.value })
        .fetch()
        .map((m) => {
          const user = Meteor.users.findOne(m.user_id);
          return {
            _id: m._id,
            user_id: m.user_id,
            role: m.role,
            name: getUserDisplayName(user),
            joined_at: new Date(m.joined_at).toLocaleDateString(),
          };
        });
    });

    const pendingInvites = useTracker(() => {
      return OrganizationInvites.find({ org_id: activeOrgId.value, used_by: null }).fetch();
    });

    const orgPlayers = useTracker(() => {
      return Players.find({ org_id: activeOrgId.value }, { sort: { name: 1 } })
        .fetch()
        .map((p) => {
          const rating = CombinedRatings.findOne({ player_id: p._id }, { sort: { date_time: 1 } });
          return {
            ...p,
            initialRating: rating ? Math.round(rating.rating) : 'N/A',
            isGuest: !p.user_id,
          };
        });
    });

    async function generateInvite() {
      errorMsg.value = '';
      successMsg.value = '';
      try {
        const token = await Meteor.callAsync('create_invite', { org_id: activeOrgId.value });
        inviteLink.value = token;
        successMsg.value = 'Invite code generated! Share it with the person you want to invite.';
      } catch (err) {
        errorMsg.value = err.reason || err.message;
      }
    }

    async function addGuestPlayer() {
      errorMsg.value = '';
      successMsg.value = '';
      if (guestName.value.trim().length < 2) {
        errorMsg.value = 'Player name must be at least 2 characters.';
        return;
      }
      try {
        await Meteor.callAsync('add_player', {
          playername: guestName.value.trim(),
          rating: guestRating.value,
          org_id: activeOrgId.value,
        });
        successMsg.value = `Guest player "${guestName.value.trim()}" added!`;
        guestName.value = '';
        guestRating.value = 1250;
        refreshRatings();
      } catch (err) {
        errorMsg.value = err.reason || err.message;
      }
    }

    async function setRole(targetUserId, role) {
      errorMsg.value = '';
      successMsg.value = '';
      try {
        await Meteor.callAsync('set_member_role', {
          org_id: activeOrgId.value,
          target_user_id: targetUserId,
          role,
        });
        successMsg.value = 'Role updated.';
      } catch (err) {
        errorMsg.value = err.reason || err.message;
      }
    }

    async function removeMember(targetUserId) {
      errorMsg.value = '';
      successMsg.value = '';
      try {
        await Meteor.callAsync('remove_member', {
          org_id: activeOrgId.value,
          target_user_id: targetUserId,
        });
        successMsg.value = 'Member removed.';
      } catch (err) {
        errorMsg.value = err.reason || err.message;
      }
    }

    async function leaveOrg() {
      errorMsg.value = '';
      try {
        await Meteor.callAsync('leave_organization', { org_id: activeOrgId.value });
        setActiveOrg(null);
      } catch (err) {
        errorMsg.value = err.reason || err.message;
      }
    }

    async function removePlayer(playerId) {
      errorMsg.value = '';
      successMsg.value = '';
      try {
        await Meteor.callAsync('remove_player_from_org', {
          org_id: activeOrgId.value,
          player_id: playerId,
        });
        successMsg.value = 'Player removed.';
      } catch (err) {
        errorMsg.value = err.reason || err.message;
      }
    }

    function copyInviteCode() {
      navigator.clipboard.writeText(inviteLink.value);
      successMsg.value = 'Invite code copied to clipboard!';
    }

    return {
      org,
      currentMember,
      isOwner,
      isOwnerOrMaintainer,
      members,
      pendingInvites,
      orgPlayers,
      errorMsg,
      successMsg,
      inviteLink,
      guestName,
      guestRating,
      ratingOptions,
      generateInvite,
      addGuestPlayer,
      setRole,
      removeMember,
      leaveOrg,
      removePlayer,
      copyInviteCode,
    };
  },
  template: `
    <div class="container">
      <div class="row justify-content-center">
        <div class="col-lg-8">
          <h3 class="text-center mb-4">Manage Organization</h3>
          <h5 class="text-center text-muted mb-4" v-if="org">{{ org.name }}</h5>

          <div v-if="errorMsg" class="alert alert-danger">{{ errorMsg }}</div>
          <div v-if="successMsg" class="alert alert-success">{{ successMsg }}</div>

          <!-- Invite Section -->
          <div v-if="isOwnerOrMaintainer" class="card mb-4">
            <div class="card-header fw-bold">Invite Members</div>
            <div class="card-body">
              <p class="text-muted small">Generate an invite code to share with someone you want to invite. They will need to create an account and enter this code on the Organizations page.</p>
              <button class="btn btn-primary mb-3" @click="generateInvite">Generate Invite Code</button>
              <div v-if="inviteLink" class="input-group">
                <input type="text" class="form-control font-monospace" :value="inviteLink" readonly>
                <button class="btn btn-outline-secondary" @click="copyInviteCode">Copy</button>
              </div>
            </div>
          </div>

          <!-- Add Guest Player -->
          <div v-if="isOwnerOrMaintainer" class="card mb-4">
            <div class="card-header fw-bold">Add Guest Player</div>
            <div class="card-body">
              <p class="text-muted small">Add a player who doesn't have an account so they can be included in matches.</p>
              <form @submit.prevent="addGuestPlayer" class="row g-2 align-items-end">
                <div class="col-sm">
                  <label class="form-label small">Name</label>
                  <input v-model="guestName" type="text" class="form-control form-control-sm" placeholder="Player name" required minlength="2">
                </div>
                <div class="col-sm-auto">
                  <label class="form-label small">Initial Rating</label>
                  <select v-model="guestRating" class="form-select form-select-sm">
                    <option v-for="opt in ratingOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                  </select>
                </div>
                <div class="col-sm-auto">
                  <button type="submit" class="btn btn-primary btn-sm">Add</button>
                </div>
              </form>
            </div>
          </div>

          <!-- Members Table -->
          <div class="card mb-4">
            <div class="card-header fw-bold">Members ({{ members.length }})</div>
            <div class="card-body">
              <div class="table-responsive">
                <table class="table table-sm table-hover mb-0">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Role</th>
                      <th>Joined</th>
                      <th v-if="isOwner">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="m in members" :key="m._id">
                      <td>{{ m.name }}</td>
                      <td>
                        <span class="badge" :class="{
                          'bg-warning text-dark': m.role === 'owner',
                          'bg-info text-dark': m.role === 'maintainer',
                          'bg-secondary': m.role === 'member',
                        }">{{ m.role }}</span>
                      </td>
                      <td>{{ m.joined_at }}</td>
                      <td v-if="isOwner">
                        <div v-if="m.role !== 'owner'" class="d-flex gap-1 flex-wrap">
                          <button v-if="m.role !== 'maintainer'"
                                  class="btn btn-outline-info btn-sm"
                                  @click="setRole(m.user_id, 'maintainer')">
                            Make Maintainer
                          </button>
                          <button v-if="m.role === 'maintainer'"
                                  class="btn btn-outline-secondary btn-sm"
                                  @click="setRole(m.user_id, 'member')">
                            Demote to Member
                          </button>
                          <button class="btn btn-outline-danger btn-sm"
                                  @click="removeMember(m.user_id)">
                            Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <!-- Players in Org -->
          <div v-if="isOwnerOrMaintainer" class="card mb-4">
            <div class="card-header fw-bold">Players ({{ orgPlayers.length }})</div>
            <div class="card-body">
              <div class="table-responsive">
                <table class="table table-sm table-hover mb-0">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Rating</th>
                      <th>Type</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="p in orgPlayers" :key="p._id">
                      <td>
                        <router-link :to="'/player/' + p._id">{{ p.name }}</router-link>
                      </td>
                      <td>{{ p.initialRating }}</td>
                      <td>
                        <span class="badge" :class="p.isGuest ? 'bg-outline-secondary border' : 'bg-primary'">
                          {{ p.isGuest ? 'Guest' : 'Member' }}
                        </span>
                      </td>
                      <td>
                        <button class="btn btn-outline-danger btn-sm" @click="removePlayer(p._id)">
                          Remove
                        </button>
                      </td>
                    </tr>
                    <tr v-if="orgPlayers.length === 0">
                      <td colspan="4" class="text-center text-muted">No players yet</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <!-- Leave org (non-owners only) -->
          <div v-if="currentMember && currentMember.role !== 'owner'" class="text-center">
            <button class="btn btn-outline-danger" @click="leaveOrg">Leave Organization</button>
          </div>
        </div>
      </div>
    </div>
  `,
});
