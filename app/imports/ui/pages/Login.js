import { Meteor } from 'meteor/meteor';
import { Accounts } from 'meteor/accounts-base';
import { defineComponent, ref } from 'vue';
import { useRouter } from 'vue-router';

export default defineComponent({
  name: 'Login',
  setup() {
    const router = useRouter();
    const displayName = ref('');
    const email = ref('');
    const password = ref('');
    const confirmPassword = ref('');
    const isRegistering = ref(false);
    const errorMsg = ref('');
    const successMsg = ref('');
    const loading = ref(false);

    function friendlyError(err) {
      const reason = err.reason || err.message || '';
      if (/email already exists/i.test(reason)) {
        return 'An account with that email already exists. Try signing in instead.';
      }
      if (/user not found/i.test(reason)) {
        return 'No account found with that email.';
      }
      if (/incorrect password/i.test(reason)) {
        return 'Incorrect password.';
      }
      return reason || 'Something went wrong. Please try again.';
    }

    function submitEmailPassword() {
      errorMsg.value = '';
      successMsg.value = '';

      if (isRegistering.value && !displayName.value.trim()) {
        errorMsg.value = 'Display name is required.';
        return;
      }
      if (!email.value || !password.value) {
        errorMsg.value = 'Email and password are required.';
        return;
      }

      loading.value = true;

      if (isRegistering.value) {
        if (password.value !== confirmPassword.value) {
          errorMsg.value = 'Passwords do not match.';
          loading.value = false;
          return;
        }
        if (password.value.length < 6) {
          errorMsg.value = 'Password must be at least 6 characters.';
          loading.value = false;
          return;
        }
        Accounts.createUser(
          {
            email: email.value,
            password: password.value,
            profile: { name: displayName.value.trim() },
          },
          (err) => {
            loading.value = false;
            if (err) {
              errorMsg.value = friendlyError(err);
            } else {
              router.push({ name: 'organizations' });
            }
          },
        );
      } else {
        Meteor.loginWithPassword(email.value, password.value, (err) => {
          loading.value = false;
          if (err) {
            errorMsg.value = friendlyError(err);
          } else {
            router.push({ name: 'organizations' });
          }
        });
      }
    }

    function toggleMode() {
      isRegistering.value = !isRegistering.value;
      errorMsg.value = '';
      successMsg.value = '';
    }

    return {
      displayName,
      email,
      password,
      confirmPassword,
      isRegistering,
      errorMsg,
      successMsg,
      loading,
      submitEmailPassword,
      toggleMode,
    };
  },
  template: `
    <div class="login-page">
      <div class="login-card">
        <h2 class="text-center mb-1">ScoreKeeper</h2>
        <p class="text-center text-muted mb-4">Foosball Edition</p>

        <div v-if="errorMsg" class="alert alert-danger py-2">{{ errorMsg }}</div>
        <div v-if="successMsg" class="alert alert-success py-2">{{ successMsg }}</div>

        <form @submit.prevent="submitEmailPassword">
          <div v-if="isRegistering" class="mb-3">
            <input v-model="displayName" type="text" class="form-control" placeholder="Display Name" required>
          </div>
          <div class="mb-3">
            <input v-model="email" type="email" class="form-control" placeholder="Email" required>
          </div>
          <div class="mb-3">
            <input v-model="password" type="password" class="form-control" placeholder="Password" required>
          </div>
          <div v-if="isRegistering" class="mb-3">
            <input v-model="confirmPassword" type="password" class="form-control" placeholder="Confirm Password" required>
          </div>
          <button type="submit" class="btn btn-primary w-100" :disabled="loading">
            {{ isRegistering ? 'Create Account' : 'Sign In' }}
          </button>
        </form>

        <div class="text-center mt-3">
          <a href="#" class="text-muted small" @click.prevent="toggleMode">
            {{ isRegistering ? 'Already have an account? Sign in' : 'Need an account? Register' }}
          </a>
        </div>
      </div>
    </div>
  `,
});
