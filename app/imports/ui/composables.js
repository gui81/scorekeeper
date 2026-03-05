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
