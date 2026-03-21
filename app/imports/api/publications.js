import { Meteor } from 'meteor/meteor';
import { check } from 'meteor/check';
import {
  Matches,
  Players,
  CombinedRatings,
  SinglesRatings,
  OffenseRatings,
  DefenseRatings,
  TeamRatings,
} from './collections';
import { OrganizationMembers } from './organizations';

async function requireOrgAccess(userId, orgId) {
  if (!userId) return false;
  return !!(await OrganizationMembers.findOneAsync({ org_id: orgId, user_id: userId }));
}

Meteor.publish('matches', async function (orgId) {
  if (!orgId) return this.ready();
  check(orgId, String);
  if (!(await requireOrgAccess(this.userId, orgId))) return this.ready();
  return Matches.find({ org_id: orgId });
});

Meteor.publish('players', async function (orgId) {
  if (!orgId) return this.ready();
  check(orgId, String);
  if (!(await requireOrgAccess(this.userId, orgId))) return this.ready();
  return Players.find({ org_id: orgId });
});

Meteor.publish('combined_ratings', async function (orgId) {
  if (!orgId) return this.ready();
  check(orgId, String);
  if (!(await requireOrgAccess(this.userId, orgId))) return this.ready();
  const playerIds = (await Players.find({ org_id: orgId }).fetchAsync()).map((p) => p._id);
  return CombinedRatings.find({ player_id: { $in: playerIds } });
});

Meteor.publish('singles_ratings', async function (orgId) {
  if (!orgId) return this.ready();
  check(orgId, String);
  if (!(await requireOrgAccess(this.userId, orgId))) return this.ready();
  const playerIds = (await Players.find({ org_id: orgId }).fetchAsync()).map((p) => p._id);
  return SinglesRatings.find({ player_id: { $in: playerIds } });
});

Meteor.publish('offense_ratings', async function (orgId) {
  if (!orgId) return this.ready();
  check(orgId, String);
  if (!(await requireOrgAccess(this.userId, orgId))) return this.ready();
  const playerIds = (await Players.find({ org_id: orgId }).fetchAsync()).map((p) => p._id);
  return OffenseRatings.find({ player_id: { $in: playerIds } });
});

Meteor.publish('defense_ratings', async function (orgId) {
  if (!orgId) return this.ready();
  check(orgId, String);
  if (!(await requireOrgAccess(this.userId, orgId))) return this.ready();
  const playerIds = (await Players.find({ org_id: orgId }).fetchAsync()).map((p) => p._id);
  return DefenseRatings.find({ player_id: { $in: playerIds } });
});

Meteor.publish('team_ratings', async function (orgId) {
  if (!orgId) return this.ready();
  check(orgId, String);
  if (!(await requireOrgAccess(this.userId, orgId))) return this.ready();
  const playerIds = (await Players.find({ org_id: orgId }).fetchAsync()).map((p) => p._id);
  return TeamRatings.find({
    offense_id: { $in: playerIds },
    defense_id: { $in: playerIds },
  });
});
