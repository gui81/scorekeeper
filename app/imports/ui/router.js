import { Meteor } from 'meteor/meteor';
import { createRouter, createWebHistory } from 'vue-router';
import Home from './pages/Home.js';
import AddMatch from './pages/AddMatch.js';
import IndividualStats from './pages/IndividualStats.js';
import TeamStats from './pages/TeamStats.js';
import Rules from './pages/Rules.js';
import PlayerDetail from './pages/PlayerDetail.js';
import Login from './pages/Login.js';
import OrganizationSelect from './pages/OrganizationSelect.js';
import ManageOrganization from './pages/ManageOrganization.js';
import Profile from './pages/Profile.js';
import { OrganizationMembers } from '../api/organizations';

const ACTIVE_ORG_KEY = 'scorekeeper_active_org';

function autoSelectOrg() {
  // Try default org from user profile
  const user = Meteor.user();
  const defaultOrgId = user?.profile?.default_org_id;
  if (defaultOrgId) {
    localStorage.setItem(ACTIVE_ORG_KEY, defaultOrgId);
    return defaultOrgId;
  }

  // Fall back to first membership
  const memberships = OrganizationMembers.find({ user_id: Meteor.userId() }).fetch();
  if (memberships.length > 0) {
    localStorage.setItem(ACTIVE_ORG_KEY, memberships[0].org_id);
    return memberships[0].org_id;
  }

  return null;
}

const routes = [
  { path: '/login', name: 'login', component: Login, meta: { public: true } },
  {
    path: '/organizations',
    name: 'organizations',
    component: OrganizationSelect,
    meta: { authOnly: true },
  },
  { path: '/profile', name: 'profile', component: Profile, meta: { authOnly: true } },
  { path: '/manage-org', name: 'manageOrg', component: ManageOrganization },
  { path: '/', name: 'home', component: Home },
  { path: '/addmatch', name: 'addmatch', component: AddMatch },
  { path: '/individualstats', name: 'individualstats', component: IndividualStats },
  { path: '/teamstats', name: 'teamstats', component: TeamStats },
  { path: '/rules', name: 'rules', component: Rules },
  { path: '/player/:id', name: 'playerDetail', component: PlayerDetail, props: true },
  {
    path: '/:pathMatch(.*)*',
    name: 'notFound',
    component: {
      template:
        '<div class="container mt-4"><h2>This is not the page you are looking for.</h2></div>',
    },
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to) => {
  const userId = Meteor.userId();
  const activeOrg = localStorage.getItem(ACTIVE_ORG_KEY);

  // Public routes (login page)
  if (to.meta.public) {
    if (userId) {
      return { name: activeOrg ? 'home' : 'organizations' };
    }
    return true;
  }

  // Not logged in -> go to login
  if (!userId) {
    return { name: 'login' };
  }

  // Auth-only routes (org selection, profile) - just need login
  if (to.meta.authOnly) {
    return true;
  }

  // All other routes require an active org — try to auto-select one
  if (!activeOrg) {
    const selected = autoSelectOrg();
    return selected ? true : { name: 'organizations' };
  }

  return true;
});

export default router;
