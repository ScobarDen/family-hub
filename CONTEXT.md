# Family Hub

A Telegram Mini App in which a family runs its shared household: plans, events and reminders, savings goals, recipes, photo albums and the care of its pets.

## Language

### People

**Family**:
A closed group of Members that owns its records; every record belongs to exactly one Family.
_Avoid_: Household, group, tenant, team

**Member**:
A person who belongs to the Family and acts in the app through their Telegram account.
_Avoid_: User, account, participant

**Family Owner**:
The one Member of a Family who may delete it, remove Members and hand the role to another Member.
_Avoid_: Admin, creator, head

**Operator**:
The person who runs the app installation and approves Family Requests; a role outside any Family with no access to Family data.
_Avoid_: Admin, superuser, moderator

**Family Request**:
A Telegram user's request to create a new Family, awaiting the Operator's approval.
_Avoid_: Application, signup, registration

**Invite**:
A single-use, expiring link through which a Member brings a new person into their Family.
_Avoid_: Invite code, referral, invitation token

**Photo**:
A picture belonging to the Family, kept in its Photo Storage; it may appear in several Albums or none.
_Avoid_: Image, picture, attachment

**Album**:
A named, always Shared selection of the Family's Photos; each Pet also has an automatic Album of its Care Entry photos.
_Avoid_: Gallery, folder, collection

**Photo Storage**:
A Family's own private Telegram channel, connected by its Family Owner, where the Family's photos are kept.
_Avoid_: Bucket, gallery, media library

**Pet**:
An animal the Family cares for; a subject of records, never an actor in the app.
_Avoid_: Animal, dog (as a type name)

**Archived Pet**:
A Pet the Family no longer actively cares for; its history stays viewable and it triggers no Reminders.
_Avoid_: Deleted pet, inactive pet

### Pet care

**Care Entry**:
A dated record in a Pet's journal of something done for or observed about that Pet.
_Avoid_: Event, log, activity

**Care Kind**:
One of the fixed categories a Care Entry belongs to: vaccination, treatment, vet visit, weight, expense or note.
_Avoid_: Entry type, category

**Pet Expense**:
Money spent on a Pet: an expense Care Entry, or the cost recorded on a vaccination, treatment or vet visit.
_Avoid_: Payment, purchase, bill

**Pet Memo**:
The pinned facts about a Pet that anyone looking after it needs now: current food, vet clinic and important notes.
_Avoid_: Profile, info, cheat sheet

**Due Date**:
The date by which a vaccination, treatment or vet visit should be repeated, set on the Care Entry that precedes it.
_Avoid_: Deadline, next date

### Feed

**Feed**:
The Family's chronology: what is overdue, what is upcoming and what Members have done.
_Avoid_: Timeline, event feed, log

**Activity**:
A past fact in the Feed that a Member did something, such as a Care Entry, a Completed Plan or a Contribution.
_Avoid_: Event, action, log entry

**Upcoming**:
A dated thing ahead of the Family shown in the Feed: an Event Occurrence, a Plan due date, a Pet's Due Date or a Reminder.
_Avoid_: Agenda, schedule

### Plans

**Plan**:
Something the Family intends to get done, optionally by a due date; it ends up Completed.
_Avoid_: Task, todo, checklist

**Subplan**:
A step inside a Plan; Plans have exactly one level of Subplans.
_Avoid_: Subtask, item, step

**Assignee**:
The one Member responsible for a Plan or Subplan; optional.
_Avoid_: Owner, executor, responsible

**Completed**:
The state of a Plan or Subplan a Member has marked as done; a Plan becomes Completed when all its Subplans are.
_Avoid_: Done, finished, closed

### Recipes

**Recipe**:
A dish the Family has written down: a title, ingredients, how to cook it, photos and tags.
_Avoid_: Dish, post, entry

**Recipe Tag**:
A Family-defined label that groups Recipes, such as «завтрак» or «для гостей».
_Avoid_: Category, hashtag

**Cooked**:
A mark a Member puts on a Recipe each time the Family cooks it; it records who and when.
_Avoid_: Made, done, prepared

### Savings

**Savings Goal**:
An amount of money the Family or a Member intends to accumulate, optionally by a deadline.
_Avoid_: Piggy bank, fund, budget

**Contribution**:
A recorded amount a Member put toward a Savings Goal.
_Avoid_: Deposit, transaction, payment

**Withdrawal**:
A recorded amount taken back out of a Savings Goal.
_Avoid_: Expense, spending, transaction

**Balance**:
The sum of a Savings Goal's Contributions minus its Withdrawals; never negative.
_Avoid_: Total, saved amount

**Achieved**:
The state of a Savings Goal whose Balance has reached its target; it reverts if the Balance drops below.
_Avoid_: Done, reached, finished

**Completed Goal**:
A Savings Goal a Member has closed as either fulfilled or cancelled; it is read-only.
_Avoid_: Archived goal, closed goal

### Calendar

**Event**:
A dated entry in the Family calendar, either all-day or at a specific time.
_Avoid_: Meeting, appointment, task

**Recurrence**:
The rule by which an Event or Reminder repeats: weekly, monthly or yearly, optionally until an end date.
_Avoid_: Repeat, schedule, series rule

**Occurrence**:
One concrete date of a recurring Event or Reminder.
_Avoid_: Instance, repetition

### Reminders

**Reminder**:
A prompt the bot delivers to chosen Members in Telegram at a given moment; it comes from an Event, a Pet's Due Date, or stands alone.
_Avoid_: Notification, alert, push

**Recipient**:
A Member a Reminder is delivered to.
_Avoid_: Subscriber, target

### Visibility

**Shared**:
Visible to and editable by every Member of the Family; the default for every record.
_Avoid_: Public, common

**Private**:
Visible only to the Member who owns it.
_Avoid_: Personal, hidden, secret
