import { Meteor } from 'meteor/meteor';
import { check, Match } from 'meteor/check';
import { Random } from 'meteor/random';
import { Organizations, OrganizationMembers, OrganizationInvites } from './organizations';
import {
  Players,
  Matches,
  CombinedRatings,
  SinglesRatings,
  OffenseRatings,
  DefenseRatings,
  TeamRatings,
} from './collections';
import { addPlayer } from './methods';

function requireUser() {
  if (!Meteor.userId()) {
    throw new Meteor.Error('not-authorized', 'You must be logged in');
  }
  return Meteor.userId();
}

async function requireOrgRole(orgId, roles) {
  const userId = requireUser();
  const member = await OrganizationMembers.findOneAsync({
    org_id: orgId,
    user_id: userId,
  });
  if (!member || !roles.includes(member.role)) {
    throw new Meteor.Error('not-authorized', 'You do not have permission for this action');
  }
  return member;
}

const DEFAULT_RATING = 1250;

async function createPlayerForUser(userId, orgId) {
  // Skip if a player already exists for this user in this org
  const existing = await Players.findOneAsync({ user_id: userId, org_id: orgId });
  if (existing) return existing._id;

  const user = await Meteor.users.findOneAsync(userId);
  const name = user?.profile?.name || user?.emails?.[0]?.address || 'Player';

  return addPlayer(name, DEFAULT_RATING, orgId, userId);
}

Meteor.methods({
  async update_profile_name(doc) {
    const userId = requireUser();
    check(doc, { name: String });

    if (doc.name.trim().length < 1) {
      throw new Meteor.Error('invalid-name', 'Display name is required');
    }

    await Meteor.users.updateAsync(userId, {
      $set: { 'profile.name': doc.name.trim() },
    });
  },

  async create_organization(doc) {
    const userId = requireUser();
    check(doc, { name: String });

    if (doc.name.trim().length < 2) {
      throw new Meteor.Error('invalid-name', 'Organization name must be at least 2 characters');
    }

    const orgId = await Organizations.insertAsync({
      name: doc.name.trim(),
      owner_id: userId,
      created_at: Date.now(),
    });

    await OrganizationMembers.insertAsync({
      org_id: orgId,
      user_id: userId,
      role: 'owner',
      joined_at: Date.now(),
    });

    // Auto-create a player for the org creator
    await createPlayerForUser(userId, orgId);

    return orgId;
  },

  async create_invite(doc) {
    check(doc, { org_id: String });
    await requireOrgRole(doc.org_id, ['owner', 'maintainer']);

    const token = Random.hexString(24);

    await OrganizationInvites.insertAsync({
      org_id: doc.org_id,
      token,
      created_by: Meteor.userId(),
      created_at: Date.now(),
      used_by: null,
      used_at: null,
    });

    return token;
  },

  async accept_invite(doc) {
    const userId = requireUser();
    check(doc, { token: String });

    const invite = await OrganizationInvites.findOneAsync({
      token: doc.token,
      used_by: null,
    });

    if (!invite) {
      throw new Meteor.Error(
        'invalid-invite',
        'This invite code is invalid or has already been used',
      );
    }

    const existing = await OrganizationMembers.findOneAsync({
      org_id: invite.org_id,
      user_id: userId,
    });

    if (existing) {
      throw new Meteor.Error('already-member', 'You are already a member of this organization');
    }

    await OrganizationMembers.insertAsync({
      org_id: invite.org_id,
      user_id: userId,
      role: 'member',
      joined_at: Date.now(),
    });

    await OrganizationInvites.updateAsync(invite._id, {
      $set: { used_by: userId, used_at: Date.now() },
    });

    // Auto-create a player for the new member
    await createPlayerForUser(userId, invite.org_id);

    return invite.org_id;
  },

  async set_member_role(doc) {
    check(doc, {
      org_id: String,
      target_user_id: String,
      role: Match.Where((r) => ['maintainer', 'member'].includes(r)),
    });

    await requireOrgRole(doc.org_id, ['owner']);

    const target = await OrganizationMembers.findOneAsync({
      org_id: doc.org_id,
      user_id: doc.target_user_id,
    });

    if (!target) {
      throw new Meteor.Error('not-found', 'User is not a member of this organization');
    }

    if (target.role === 'owner') {
      throw new Meteor.Error('not-allowed', 'Cannot change the owner role');
    }

    await OrganizationMembers.updateAsync(target._id, {
      $set: { role: doc.role },
    });
  },

  async remove_member(doc) {
    check(doc, { org_id: String, target_user_id: String });
    await requireOrgRole(doc.org_id, ['owner', 'maintainer']);

    const target = await OrganizationMembers.findOneAsync({
      org_id: doc.org_id,
      user_id: doc.target_user_id,
    });

    if (!target) {
      throw new Meteor.Error('not-found', 'User is not a member of this organization');
    }

    if (target.role === 'owner') {
      throw new Meteor.Error('not-allowed', 'Cannot remove the organization owner');
    }

    await OrganizationMembers.removeAsync(target._id);
  },

  async leave_organization(doc) {
    const userId = requireUser();
    check(doc, { org_id: String });

    const member = await OrganizationMembers.findOneAsync({
      org_id: doc.org_id,
      user_id: userId,
    });

    if (!member) {
      throw new Meteor.Error('not-found', 'You are not a member of this organization');
    }

    if (member.role === 'owner') {
      throw new Meteor.Error(
        'not-allowed',
        'The owner cannot leave. Transfer ownership or delete the organization.',
      );
    }

    await OrganizationMembers.removeAsync(member._id);
  },

  async remove_player_from_org(doc) {
    check(doc, { org_id: String, player_id: String });
    await requireOrgRole(doc.org_id, ['owner', 'maintainer']);

    const player = await Players.findOneAsync({ _id: doc.player_id, org_id: doc.org_id });
    if (!player) {
      throw new Meteor.Error('not-found', 'Player not found in this organization');
    }

    // Remove the player and all their ratings
    await Players.removeAsync(player._id);
    await CombinedRatings.removeAsync({ player_id: player._id });
    await SinglesRatings.removeAsync({ player_id: player._id });
    await OffenseRatings.removeAsync({ player_id: player._id });
    await DefenseRatings.removeAsync({ player_id: player._id });
    await TeamRatings.removeAsync({
      $or: [{ offense_id: player._id }, { defense_id: player._id }],
    });
    // Remove matches involving this player
    await Matches.removeAsync({
      org_id: doc.org_id,
      $or: [
        { ro_id: player._id },
        { rd_id: player._id },
        { bo_id: player._id },
        { bd_id: player._id },
      ],
    });
  },
});
