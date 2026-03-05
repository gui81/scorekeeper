import { createRouter, createWebHistory } from 'vue-router';
import Home from './pages/Home.js';
import AddPlayer from './pages/AddPlayer.js';
import AddMatch from './pages/AddMatch.js';
import IndividualStats from './pages/IndividualStats.js';
import TeamStats from './pages/TeamStats.js';
import Rules from './pages/Rules.js';
import PlayerDetail from './pages/PlayerDetail.js';

const routes = [
  { path: '/', name: 'home', component: Home },
  { path: '/addplayer', name: 'addplayer', component: AddPlayer },
  { path: '/addmatch', name: 'addmatch', component: AddMatch },
  { path: '/individualstats', name: 'individualstats', component: IndividualStats },
  { path: '/teamstats', name: 'teamstats', component: TeamStats },
  { path: '/rules', name: 'rules', component: Rules },
  { path: '/player/:id', name: 'playerDetail', component: PlayerDetail, props: true },
  { path: '/:pathMatch(.*)*', name: 'notFound', component: { template: '<div class="container mt-4"><h2>This is not the page you are looking for.</h2></div>' } },
];

export default createRouter({
  history: createWebHistory(),
  routes,
});
