# Family Hub

A Telegram Mini App in which a family runs its shared household: money goals, events, reminders, shopping and the care of its pets.

## Language

### People

**Family**:
A closed group of Members that owns its records; every record belongs to exactly one Family.
_Avoid_: Household, group, tenant, team

**Member**:
A person who belongs to the Family and acts in the app through their Telegram account.
_Avoid_: User, account, participant

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
One of the fixed categories a Care Entry belongs to: feeding, walk, vaccination, treatment, weight, vet visit or note.
_Avoid_: Entry type, category

**Due Date**:
The date by which a vaccination, treatment or vet visit should be repeated, set on the Care Entry that precedes it.
_Avoid_: Deadline, next date

### Shopping

**Shopping List**:
A named list of things a Family intends to buy; it is either Shared or Private as a whole.
_Avoid_: Cart, basket, checklist

**Shopping Item**:
One line in a Shopping List: a free-text name with an optional free-text amount and note.
_Avoid_: Product, goods, entry

**Bought**:
The state of a Shopping Item once a Member has marked it as purchased; it can be undone.
_Avoid_: Done, completed, checked

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
_Avoid_: Subscriber, assignee, target

### Visibility

**Shared**:
Visible to and editable by every Member of the Family; the default for every record.
_Avoid_: Public, common

**Private**:
Visible only to the Member who owns it.
_Avoid_: Personal, hidden, secret
