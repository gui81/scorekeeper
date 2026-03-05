import { defineComponent, ref } from 'vue';

export default defineComponent({
  name: 'App',
  setup() {
    const sidebarOpen = ref(false);

    function toggleSidebar() {
      sidebarOpen.value = !sidebarOpen.value;
    }

    function closeSidebar() {
      sidebarOpen.value = false;
    }

    return { sidebarOpen, toggleSidebar, closeSidebar };
  },
  template: `
    <div id="wrapper" :class="{ 'sidebar-open': sidebarOpen }">
      <!-- Sidebar -->
      <nav id="sidebar">
        <div class="sidebar-brand">
          <router-link to="/" @click="closeSidebar">ScoreKeeper</router-link>
        </div>
        <ul class="sidebar-nav">
          <li><router-link to="/addplayer" @click="closeSidebar">Add Player</router-link></li>
          <li><router-link to="/addmatch" @click="closeSidebar">Add Match</router-link></li>
          <li><router-link to="/individualstats" @click="closeSidebar">Individual Stats</router-link></li>
          <li><router-link to="/teamstats" @click="closeSidebar">Team Stats</router-link></li>
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
        </header>
        <hr>
        <main class="content-body">
          <router-view />
        </main>
      </div>
    </div>

    <!-- Overlay for mobile sidebar -->
    <div v-if="sidebarOpen" class="sidebar-overlay" @click="closeSidebar"></div>
  `,
});
