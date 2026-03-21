import { Meteor } from 'meteor/meteor';
import { defineComponent, ref, watch, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useUser, useUserId, useTracker, useSubscribe, useActiveOrg } from './composables';
import { Organizations, OrganizationMembers } from '../api/organizations';

export default defineComponent({
  name: 'App',
  setup() {
    const router = useRouter();
    const sidebarOpen = ref(false);
    const user = useUser();
    const userId = useUserId();
    const { activeOrgId, setActiveOrg } = useActiveOrg();

    useSubscribe('user_organizations');

    // Keep a reliable subscription to the active org's document
    let orgSubHandle = null;
    watch(
      activeOrgId,
      (newId) => {
        if (orgSubHandle) orgSubHandle.stop();
        if (newId) {
          orgSubHandle = Meteor.subscribe('organization_by_id', newId);
        }
      },
      { immediate: true },
    );
    onUnmounted(() => {
      if (orgSubHandle) orgSubHandle.stop();
    });

    const activeOrg = useTracker(() => {
      if (!activeOrgId.value) return null;
      return Organizations.findOne(activeOrgId.value);
    });

    const currentRole = useTracker(() => {
      if (!activeOrgId.value || !Meteor.userId()) return null;
      const member = OrganizationMembers.findOne({
        org_id: activeOrgId.value,
        user_id: Meteor.userId(),
      });
      return member ? member.role : null;
    });

    const userOrgs = useTracker(() => {
      if (!Meteor.userId()) return [];
      const memberships = OrganizationMembers.find({ user_id: Meteor.userId() }).fetch();
      return memberships.map((m) => {
        const org = Organizations.findOne(m.org_id);
        return { _id: m.org_id, name: org ? org.name : '...' };
      });
    });

    // Redirect to login when user logs out
    watch(userId, (newVal) => {
      if (!newVal) {
        setActiveOrg(null);
        router.push({ name: 'login' });
      }
    });

    function toggleSidebar() {
      sidebarOpen.value = !sidebarOpen.value;
    }

    function closeSidebar() {
      sidebarOpen.value = false;
    }

    function logout() {
      Meteor.logout();
      setActiveOrg(null);
    }

    function switchOrg(orgId) {
      setActiveOrg(orgId);
    }

    const avatarMenuOpen = ref(false);

    function displayName() {
      if (!user.value) return '';
      if (user.value.profile?.name) return user.value.profile.name;
      if (user.value.emails?.length) return user.value.emails[0].address;
      return 'User';
    }

    function userEmail() {
      if (!user.value) return '';
      if (user.value.emails?.length) return user.value.emails[0].address;
      return '';
    }

    function initials() {
      const name = displayName();
      if (!name) return '?';
      const parts = name.trim().split(/\s+/);
      if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      return name[0].toUpperCase();
    }

    function toggleAvatarMenu() {
      avatarMenuOpen.value = !avatarMenuOpen.value;
    }

    function closeAvatarMenu() {
      avatarMenuOpen.value = false;
    }

    return {
      sidebarOpen,
      user,
      userId,
      activeOrg,
      activeOrgId,
      currentRole,
      userOrgs,
      avatarMenuOpen,
      toggleSidebar,
      closeSidebar,
      logout,
      switchOrg,
      displayName,
      userEmail,
      initials,
      toggleAvatarMenu,
      closeAvatarMenu,
    };
  },
  template: `
    <div v-if="!userId" id="login-wrapper">
      <router-view />
    </div>

    <div v-else-if="!activeOrgId" id="no-org-wrapper">
      <header class="content-header border-bottom mb-3">
        <h1 class="mb-0">ScoreKeeper <small class="text-muted">Foosball Edition</small></h1>
        <div class="ms-auto avatar-menu-wrapper">
          <button class="avatar-btn" @click="toggleAvatarMenu" :title="displayName()">
            {{ initials() }}
          </button>
          <div v-if="avatarMenuOpen" class="avatar-dropdown">
            <div class="avatar-dropdown-header">
              <div class="fw-bold">{{ displayName() }}</div>
              <div class="text-muted small">{{ userEmail() }}</div>
            </div>
            <hr class="my-1">
            <router-link to="/profile" class="avatar-dropdown-item" @click="closeAvatarMenu">Profile</router-link>
            <button class="avatar-dropdown-item" @click="logout">Logout</button>
          </div>
        </div>
      </header>
      <router-view />
    </div>

    <div v-else id="wrapper" :class="{ 'sidebar-open': sidebarOpen }">
      <!-- Sidebar -->
      <nav id="sidebar">
        <div class="sidebar-brand">
          <router-link to="/" @click="closeSidebar">ScoreKeeper</router-link>
        </div>

        <!-- Organization selector -->
        <div class="sidebar-org px-3 py-2 border-bottom border-dark">
          <select class="form-select form-select-sm bg-dark text-light border-secondary"
                  :value="activeOrgId"
                  @change="switchOrg($event.target.value)">
            <option v-for="org in userOrgs" :key="org._id" :value="org._id">{{ org.name }}</option>
          </select>
        </div>

        <ul class="sidebar-nav">
          <li><router-link to="/addmatch" @click="closeSidebar">Add Match</router-link></li>
          <li><router-link to="/individualstats" @click="closeSidebar">Individual Stats</router-link></li>
          <li><router-link to="/teamstats" @click="closeSidebar">Team Stats</router-link></li>
        </ul>

        <ul class="sidebar-nav sidebar-nav-bottom">
          <li><router-link to="/rules" @click="closeSidebar">Rules</router-link></li>
        </ul>

      </nav>

      <!-- Page Content -->
      <div id="page-content">
        <header class="content-header">
          <button id="menu-toggle" class="btn btn-outline-secondary" @click="toggleSidebar">
            &#9776;
          </button>
          <h1>ScoreKeeper <small class="text-muted">Foosball Edition</small></h1>
          <div class="ms-auto avatar-menu-wrapper">
            <button class="avatar-btn" @click="toggleAvatarMenu" :title="displayName()">
              {{ initials() }}
            </button>
            <div v-if="avatarMenuOpen" class="avatar-dropdown">
              <div class="avatar-dropdown-header">
                <div class="fw-bold">{{ displayName() }}</div>
                <div class="text-muted small">{{ userEmail() }}</div>
              </div>
              <hr class="my-1">
              <router-link to="/profile" class="avatar-dropdown-item" @click="closeAvatarMenu">Profile</router-link>
              <router-link to="/manage-org" class="avatar-dropdown-item" @click="closeAvatarMenu">Manage Organization</router-link>
              <router-link to="/organizations" class="avatar-dropdown-item" @click="closeAvatarMenu">Organizations</router-link>
              <hr class="my-1">
              <button class="avatar-dropdown-item" @click="logout">Logout</button>
            </div>
          </div>
        </header>
        <hr>
        <main class="content-body">
          <router-view :key="activeOrgId" />
        </main>
      </div>
    </div>

    <!-- Click-outside to close avatar menu -->
    <div v-if="avatarMenuOpen" class="avatar-menu-backdrop" @click="closeAvatarMenu"></div>

    <!-- Overlay for mobile sidebar -->
    <div v-if="sidebarOpen" class="sidebar-overlay" @click="closeSidebar"></div>
  `,
});
