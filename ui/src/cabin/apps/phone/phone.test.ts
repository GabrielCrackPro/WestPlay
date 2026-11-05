import { describe, expect, it } from 'vitest'
import type { PhoneCall, PhoneContact, PhoneNotification, PhoneState } from '../../../shared/host'
import { callerOf, contactFor, contactsMatching, initialsOf } from './phone'

const contacts: PhoneContact[] = [
  { id: '1', name: 'Ada Lovelace', numbers: ['+44 20 7946 0958'] },
  { id: '2', name: 'Grace Hopper', numbers: ['+1 (555) 010-2000', '+1 (555) 010-3000'] },
  { id: '3', name: 'Alan Turing', numbers: [] },
]

describe('the phone’s contacts', () => {
  it('makes initials from the first two words', () => {
    expect(initialsOf('Ada Lovelace')).toBe('AL')
    expect(initialsOf('Grace')).toBe('G')
    expect(initialsOf('  ’t Hooft  ')).toBe('TH')
    expect(initialsOf('')).toBe('?')
  })

  it('finds every contact when nothing is typed', () => {
    expect(contactsMatching(contacts, '  ')).toBe(contacts)
  })

  it('searches names without case, and parts of a number', () => {
    expect(contactsMatching(contacts, 'lovelace').map((contact) => contact.id)).toEqual(['1'])
    expect(contactsMatching(contacts, 'GRACE').map((contact) => contact.id)).toEqual(['2'])
    expect(contactsMatching(contacts, '010 30').map((contact) => contact.id)).toEqual(['2'])
    expect(contactsMatching(contacts, '5550102').map((contact) => contact.id)).toEqual(['2'])
  })

  it('finds nobody when the name and the digits match nothing', () => {
    expect(contactsMatching(contacts, 'Babbage')).toEqual([])
    expect(contactsMatching(contacts, '999')).toEqual([])
  })
})

const note = (over: Partial<PhoneNotification> = {}): PhoneNotification => ({
  id: 'n1',
  package: 'com.google.android.dialer',
  app: 'Phone',
  title: 'Ada Lovelace',
  text: '+44 20 7946 0958',
  ongoing: false,
  ...over,
})

const line = (over: Partial<PhoneState> = {}): PhoneState => ({
  connected: true,
  ready: true,
  device: null,
  notifications: [],
  contacts,
  recents: [],
  call: null,
  ...over,
})

const ringing: PhoneCall = { id: 'c1', state: 'ringing' }

describe('who is calling', () => {
  it('takes the name the phone gave for the call', () => {
    expect(
      callerOf(
        line({ call: { id: 'c1', state: 'ringing', name: 'Grace Hopper', number: '+1 555 010 2000' } }),
      ),
    ).toEqual({ name: 'Grace Hopper', number: '+1 555 010 2000' })
  })

  it('reads the dialer’s own notification when the call carries no name', () => {
    expect(callerOf(line({ call: ringing, notifications: [note()] }))).toEqual({
      name: 'Ada Lovelace',
      number: '+44 20 7946 0958',
    })
  })

  it('finds the name in the address book when the dialer only has the number', () => {
    expect(
      callerOf(line({ call: ringing, notifications: [note({ title: '+1 555 010 2000', text: 'Mobile' })] })),
    ).toEqual({ name: 'Grace Hopper', number: '+1 555 010 2000' })
  })

  it('is nobody when no call is on the line, or nothing named it', () => {
    expect(callerOf(line())).toEqual({ name: null, number: null })
    expect(
      callerOf(line({ call: ringing, notifications: [note({ package: 'com.whatsapp', title: 'Ada' })] })),
    ).toEqual({ name: null, number: null })
    expect(callerOf(line({ call: ringing }))).toEqual({ name: null, number: null })
  })
})

describe('the contact a call was with', () => {
  it('finds them by the digits the number shares, however the phone spells it', () => {
    expect(contactFor(contacts, '5550102000')?.name).toBe('Grace Hopper')
    expect(contactFor(contacts, '+1 555 010 3000')?.name).toBe('Grace Hopper')
    expect(contactFor(contacts, '442079460958')?.name).toBe('Ada Lovelace')
  })

  it('finds nobody for a number no contact has, or one too short to tell apart', () => {
    expect(contactFor(contacts, '555 010 9999')).toBeNull()
    expect(contactFor(contacts, '010')).toBeNull()
    expect(contactFor(contacts, '')).toBeNull()
  })
})
