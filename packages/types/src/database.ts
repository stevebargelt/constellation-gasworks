/**
 * Hand-written database types.
 * Run `supabase gen types typescript --local > src/supabase.gen.ts` to bootstrap
 * the auto-generated types and re-export from index.ts.
 */

export type PermissionLevel = "full" | "free_busy" | "none";
export type RelationshipStatus = "pending" | "active" | "declined" | "removed";
export type EventAttendeeStatus = "invited" | "accepted" | "declined" | "tentative";
export type TaskStatus = "todo" | "in_progress" | "complete";

export interface User {
  id: string;
  display_name: string;
  preferred_name: string | null;
  pronouns: string | null;
  avatar_url: string | null;
  username: string;
  created_at: string;
}

export interface Relationship {
  id: string;
  user_a_id: string;
  user_b_id: string;
  rel_type: string;
  custom_label: string | null;
  status: RelationshipStatus;
  created_at: string;
}

export interface RelationshipPermission {
  id: string;
  relationship_id: string;
  grantor_id: string;
  resource_type: "calendar" | "tasks" | "meals";
  level: PermissionLevel;
  updated_at: string;
}

export interface LivingSpace {
  id: string;
  creator_id: string | null;
  name: string;
  address: string | null;
  created_at: string;
}

export interface LivingSpaceMember {
  id: string;
  living_space_id: string;
  user_id: string;
  created_at: string;
}

export interface CalendarEvent {
  id: string;
  creator_id: string;
  title: string;
  description: string | null;
  location: string | null;
  start_time: string;
  end_time: string;
  is_private: boolean;
  is_all_day: boolean;
  recurrence_rule: string | null;
  recurrence_parent_id: string | null;
  created_at: string;
}

export interface VisibleCalendarEvent extends CalendarEvent {
  viewer_permission: PermissionLevel;
}

export interface EventAttendee {
  id: string;
  event_id: string;
  user_id: string;
  status: EventAttendeeStatus;
  updated_at: string;
}

export interface TaskList {
  id: string;
  creator_id: string;
  title: string;
  created_at: string;
}

export interface TaskListMember {
  id: string;
  task_list_id: string;
  user_id: string;
  created_at: string;
}

export interface Task {
  id: string;
  task_list_id: string;
  creator_id: string;
  assignee_id: string | null;
  title: string;
  description: string | null;
  due_date: string | null;
  status: TaskStatus;
  is_private: boolean;
  completed_at: string | null;
  updated_at: string;
}

export interface Recipe {
  id: string;
  owner_id: string;
  title: string;
  instructions: string | null;
  servings: number | null;
  notes: string | null;
  tags: string[];
  updated_at: string;
}

export interface RecipeIngredient {
  id: string;
  recipe_id: string;
  name: string;
  quantity: string | null;
  unit: string | null;
  sort_order: number;
}

export interface RecipeShare {
  id: string;
  recipe_id: string;
  shared_with_id: string;
  created_at: string;
}

export interface MealPlan {
  id: string;
  creator_id: string;
  title: string;
  week_start_date: string;
  living_space_id: string | null;
  updated_at: string;
}

export interface MealPlanMember {
  id: string;
  meal_plan_id: string;
  user_id: string;
  created_at: string;
}

export interface MealPlanDay {
  id: string;
  meal_plan_id: string;
  day_of_week: number;
  meal_type: string;
  recipe_id: string | null;
  free_text: string | null;
}

export interface UserColor {
  id: string;
  viewer_id: string;
  target_user_id: string;
  color: string;
  created_at: string;
}

export interface ShoppingListItem {
  id: string;
  meal_plan_id: string;
  ingredient_name: string;
  quantity: string | null;
  unit: string | null;
  is_checked: boolean;
  checked_by_id: string | null;
  updated_at: string;
}
