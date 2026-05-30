import { Meteor } from 'meteor/meteor';
import { check } from 'meteor/check';
import { Organizations, OrganizationMembers, OrganizationInvites } from './organizations';

Meteor.publish('organization_by_id', async function (orgId) {
  check(orgId, String);
  if (!this.userId) return this.ready();
  const member = await OrganizationMembers.findOneAsync({ org_id: orgId, user_id: this.userId });
  if (!member) return this.ready();
  return Organizations.find({ _id: orgId });
});

Meteor.publish('user_organizations', async function () {
  if (!this.userId) return this.ready();

  const members = await OrganizationMembers.find({ user_id: this.userId }).fetchAsync();
  const orgIds = members.map((m) => m.org_id);

  return [
    Organizations.find({ _id: { $in: orgIds } }),
    OrganizationMembers.find({ user_id: this.userId }),
  ];
});

Meteor.publish('organization_members', async function (orgId) {
  check(orgId, String);
  if (!this.userId) return this.ready();

  const member = await OrganizationMembers.findOneAsync({ org_id: orgId, user_id: this.userId });
  if (!member) return this.ready();

  const members = await OrganizationMembers.find({ org_id: orgId }).fetchAsync();
  const userIds = members.map((m) => m.user_id);

  return [
    OrganizationMembers.find({ org_id: orgId }),
    Meteor.users.find(
      { _id: { $in: userIds } },
      {
        fields: { 'profile.name': 1, emails: 1 },
      },
    ),
  ];
});

Meteor.publish('organization_invites', async function (orgId) {
  check(orgId, String);
  if (!this.userId) return this.ready();

  const member = await OrganizationMembers.findOneAsync({ org_id: orgId, user_id: this.userId });
  if (!member || !['owner', 'maintainer'].includes(member.role)) return this.ready();

  return OrganizationInvites.find({ org_id: orgId, used_by: null });
});
