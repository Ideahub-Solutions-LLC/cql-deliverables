import { sqliteTable, text, integer, uniqueIndex, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// Every change is a new event. Original plans and previous records are retained.
export const deliveryEvents = sqliteTable("delivery_events", {
  id: text("id").primaryKey(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  version: integer("version").notNull(),
  payload: text("payload").notNull(),
  actorId: text("actor_id").notNull(),
  actorName: text("actor_name").notNull(),
  at: text("at").notNull(),
}, (t) => [
  uniqueIndex("delivery_entity_version").on(t.entityType, t.entityId, t.version),
  index("delivery_events_at").on(t.at),
]);

export const deliveryUsers = sqliteTable("delivery_users", {
  username: text("username").primaryKey(),
  displayName: text("display_name").notNull(),
  role: text("role").notNull(),
  personId: text("person_id"),
  passwordSalt: text("password_salt").notNull(),
  passwordHash: text("password_hash").notNull(),
  passwordIterations: integer("password_iterations").notNull(),
  active: integer("active").notNull().default(1),
  email: text("email"),
  firstName: text("first_name").notNull().default(""),
  lastName: text("last_name").notNull().default(""),
  avatarData: text("avatar_data"),
  timezone: text("timezone").notNull().default("PST"),
  themeMode: text("theme_mode").notNull().default("default"),
}, (t) => [uniqueIndex("delivery_users_email").on(t.email).where(sql`${t.email} IS NOT NULL`)]);

export const deliverySessions = sqliteTable("delivery_sessions", {
  tokenHash: text("token_hash").primaryKey(),
  username: text("username").notNull().references(() => deliveryUsers.username, { onDelete: "cascade" }),
  workspaceId: text("workspace_id").references(() => workspaces.id),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
}, (t) => [index("delivery_sessions_expiry").on(t.expiresAt), index("delivery_sessions_workspace").on(t.workspaceId)]);

export const workspaces = sqliteTable("workspaces", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  sortOrder: integer("sort_order").notNull(),
  active: integer("active").notNull().default(1),
});

export const workspaceProjects = sqliteTable("workspace_projects", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdBy: text("created_by").notNull().references(() => deliveryUsers.username),
  createdAt: text("created_at").notNull(),
}, (t) => [
  uniqueIndex("workspace_project_name").on(t.workspaceId, t.name),
  index("workspace_projects_workspace").on(t.workspaceId, t.createdAt),
]);

export const deliveryTasks = sqliteTable("delivery_tasks", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => workspaceProjects.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  owner: text("owner").notNull(),
  ownerUsername: text("owner_username").references(() => deliveryUsers.username),
  workstream: text("workstream").notNull().default("Additional deliverables"),
  startDate: text("start_date").notNull(),
  dueDate: text("due_date").notNull(),
  deliverable: text("deliverable").notNull(),
  acceptance: text("acceptance").notNull(),
  target: text("target"),
  unit: text("unit"),
  createdBy: text("created_by").notNull().references(() => deliveryUsers.username),
  createdAt: text("created_at").notNull(),
  deletedAt: text("deleted_at"),
}, (t) => [index("delivery_tasks_project").on(t.projectId, t.dueDate)]);

export const deliveryComments = sqliteTable("delivery_comments", {
  id: text("id").primaryKey(),
  taskId: text("task_id").notNull(),
  authorUsername: text("author_username").notNull().references(() => deliveryUsers.username),
  parentId: text("parent_id").references((): any => deliveryComments.id, { onDelete: "restrict" }),
  content: text("content").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (t) => [index("delivery_comments_task").on(t.taskId, t.createdAt)]);

export const deliveryNotifications = sqliteTable("delivery_notifications", {
  id: text("id").primaryKey(),
  recipientUsername: text("recipient_username").notNull().references(() => deliveryUsers.username),
  actorUsername: text("actor_username").notNull().references(() => deliveryUsers.username),
  taskId: text("task_id"),
  kind: text("kind").notNull(),
  message: text("message").notNull(),
  readAt: text("read_at"),
  createdAt: text("created_at").notNull(),
}, (t) => [index("delivery_notifications_recipient").on(t.recipientUsername, t.createdAt)]);
