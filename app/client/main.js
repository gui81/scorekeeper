// Import createApp from the full Vue build (includes template compiler)
// so that component template strings are compiled at runtime.
import { createApp } from 'vue/dist/vue.esm-bundler.js';
import App from '../imports/ui/App.js';
import router from '../imports/ui/router.js';

import 'bootstrap/dist/css/bootstrap.min.css';
import './main.css';

// Import collections on the client so minimongo is set up
import '../imports/api/collections';
import '../imports/api/organizations';

const app = createApp(App);
app.use(router);
app.mount('#app');
