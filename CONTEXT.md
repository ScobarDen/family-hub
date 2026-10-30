# Family Hub

A Telegram Mini App in which a family runs its shared household: tasks, savings goals, recipes, photo albums and the care of its pets.

## Language

### People

**Family**:
A closed group of Members that owns its records; every record belongs to exactly one Family.
_Avoid_: Household, group, tenant, team

**Member**:
A person who belongs to the Family and acts in the app through their Telegram account.
_Avoid_: User, account, participant

**Profile Picture**:
The picture a Member shows in their Telegram profile; the app shows it but never keeps it, and it is not a Photo.
_Avoid_: Avatar, userpic, member photo

**Installed App**:
Family Hub running on its own, outside Telegram, which a Member enters with their Telegram account; only Members can use it.
_Avoid_: PWA, desktop app, standalone

**Device**:
A browser or Installed App in which a Member signed in with their Telegram account; it stays signed in until the Member revokes it or leaves it unused for 90 days.
_Avoid_: Session, client, browser

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

**Upload Batch**:
Photos one Member added to one Album in a single sitting, shown in the Feed as one Activity; it continues while the pauses between additions stay short and disappears with its last Photo.
_Avoid_: Upload, batch upload, post

**Photo Storage**:
A Family's own private Telegram channel, connected by its Family Owner, where the Family's photos are kept.
_Avoid_: Bucket, gallery, media library

**Pet**:
An animal the Family cares for; a subject of records, never an actor in the app.
_Avoid_: Animal, dog (as a type name)

**Pet Avatar**:
The one Photo that stands for a Pet: at the top of its card, on its lines in the Feed and on Today. Either a photo of one of its Care Entries or one uploaded for it alone.
_Avoid_: Pet photo, portrait, cover

**Archived Pet**:
A Pet the Family no longer actively cares for; its history stays viewable and it triggers no Reminders.
_Avoid_: Deleted pet, inactive pet

### Pet care

**Care Entry**:
A dated record in a Pet's journal of something done for or observed about that Pet; what is still to be done for a Pet is a Task linked to it.
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

### Feed

**Feed**:
The Family's chronology: what is overdue, what is upcoming and what Members have done.
_Avoid_: Timeline, event feed, log

**Activity**:
A past fact in the Feed that a Member did something, such as a Care Entry, a Completed Task or a Contribution.
_Avoid_: Event, action, log entry

**Upcoming**:
A Task Occurrence or a Pet's birthday ahead of the Family, shown in the Feed.
_Avoid_: Agenda, schedule

**Overdue**:
A Task Occurrence with Assignees whose date has passed while it is not Completed; a Task without Assignees never becomes Overdue. Of a recurring Task, only the Occurrences of the last 30 days count.
_Avoid_: Late, urgent, missed

### Tasks

**Task**:
Anything the Family intends to do or has coming up: optionally a date with a time and an end, Assignees, a Recurrence, Reminders, Subtasks and a linked Pet or Album; a Task without a date has no Occurrences. «Дело» in the app.
_Avoid_: Plan, Event, Due Date, todo, appointment

**Subtask**:
A step inside a Task without a Recurrence; Tasks have exactly one level of Subtasks.
_Avoid_: Subplan, item, step

**Assignee**:
A Member responsible for a Task or Subtask; a Task may have several or none, and any one of them completes it for all.
_Avoid_: Owner, executor, responsible

**Completed**:
The state of a Task Occurrence or Subtask a Member has marked as done, in the app or from a Reminder, in the bot or on a Push; a Task becomes Completed when all its Subtasks are.
_Avoid_: Done, finished, closed

**Recurrence**:
The rule by which a Task repeats: weekly, monthly or yearly, optionally until an end date.
_Avoid_: Repeat, schedule, series rule

**Occurrence**:
One concrete date of a Task; each Occurrence of a recurring Task is Completed or skipped on its own, while edits apply to all of them.
_Avoid_: Instance, repetition

**Reminder**:
A prompt delivered to a Task's Recipients at a set offset from an Occurrence, through the bot in Telegram, as a Push, or both, as each Recipient chooses.
_Avoid_: Notification, alert

**Push**:
Delivery of a Reminder to a Recipient's Devices outside Telegram.
_Avoid_: Notification, web push, alert

**Recipient**:
A Member a Reminder is delivered to; by default a Task's Assignees, or its author when it has none.
_Avoid_: Subscriber, target

### Recipes

**Recipe**:
A dish the Family has written down: a title, ingredients, how to cook it, photos and tags.
_Avoid_: Dish, post, entry

**Recipe Tag**:
A Family-defined label that groups Recipes, such as «завтрак» or «для гостей».
_Avoid_: Category, hashtag

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

### Commands

**Command Draft**:
A record the app assembled from what a Member said or typed, shown for confirmation; nothing is created until the Member confirms it.
_Avoid_: Intent, suggestion, AI draft, voice command

### Visibility

**Shared**:
Visible to and editable by every Member of the Family; the default for every record.
_Avoid_: Public, common

**Private**:
Visible only to the Member who owns it.
_Avoid_: Personal, hidden, secret
