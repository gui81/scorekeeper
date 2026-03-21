import { Tracker } from 'meteor/tracker';
import { Meteor } from 'meteor/meteor';
import { ref, onUnmounted } from 'vue';

/**
 * Reactive wrapper around Meteor's Tracker.autorun for use in Vue 3 components.
 * The provided function runs inside a Tracker computation and its return value
 * is stored in a Vue ref that updates reactively.
 */
export function useTracker(fn) {
  const result = ref(fn());

  const computation = Tracker.autorun(() => {
    result.value = fn();
  });

  onUnmounted(() => {
    computation.stop();
  });

  return result;
}

/**
 * Subscribe to a Meteor publication and return a reactive readiness ref.
 */
export function useSubscribe(...args) {
  const isReady = ref(false);

  const handle = Meteor.subscribe(...args, {
    onReady() {
      isReady.value = true;
    },
  });

  onUnmounted(() => {
    handle.stop();
  });

  return isReady;
}

/**
 * Reactive current user.
 */
export function useUser() {
  return useTracker(() => Meteor.user());
}

/**
 * Reactive user ID.
 */
export function useUserId() {
  return useTracker(() => Meteor.userId());
}

// Active organization stored in localStorage for persistence across page reloads
const ACTIVE_ORG_KEY = 'scorekeeper_active_org';

const activeOrgId = ref(localStorage.getItem(ACTIVE_ORG_KEY) || null);

export function useActiveOrg() {
  function setActiveOrg(orgId) {
    activeOrgId.value = orgId;
    if (orgId) {
      localStorage.setItem(ACTIVE_ORG_KEY, orgId);
    } else {
      localStorage.removeItem(ACTIVE_ORG_KEY);
    }
  }

  // Sync from localStorage in case router guard auto-selected an org
  function syncFromStorage() {
    const stored = localStorage.getItem(ACTIVE_ORG_KEY);
    if (stored !== activeOrgId.value) {
      activeOrgId.value = stored || null;
    }
  }

  return { activeOrgId, setActiveOrg, syncFromStorage };
}
