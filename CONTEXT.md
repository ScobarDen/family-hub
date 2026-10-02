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

### Reminders

**Reminder**:
A message the bot sends to chosen Members in Telegram at a given moment.
_Avoid_: Notification, alert, push

### Visibility

**Shared**:
Visible to and editable by every Member of the Family; the default for every record.
_Avoid_: Public, common

**Private**:
Visible only to the Member who owns it.
_Avoid_: Personal, hidden, secret
