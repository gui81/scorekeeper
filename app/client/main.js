// Import the full Vue build (includes template compiler) so that
// component template strings are compiled at runtime.
// This side-effect import registers the compiler with @vue/runtime-dom,
// making it available to all components imported from 'vue' as well.
import 'vue/dist/vue.esm-bundler.js';

import { createApp } from 'vue';
import App from '../imports/ui/App.js';
import router from '../imports/ui/router.js';

import 'bootstrap/dist/css/bootstrap.min.css';
import './main.css';

// Import collections on the client so minimongo is set up
import '../imports/api/collections';

const app = createApp(App);
app.use(router);
app.mount('#app');
