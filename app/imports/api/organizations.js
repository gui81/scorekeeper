import { Mongo } from 'meteor/mongo';

export const Organizations = new Mongo.Collection('organizations');
export const OrganizationMembers = new Mongo.Collection('organization_members');
export const OrganizationInvites = new Mongo.Collection('organization_invites');
