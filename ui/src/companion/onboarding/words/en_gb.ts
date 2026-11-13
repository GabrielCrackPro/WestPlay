import type { Words } from '.'
import { words as american } from './en_us'

/** British English: American English's words, with British punctuation where they differ (single quotes,
 * the full stop outside them). */
export const words: Words = {
  ...american,
  locale: 'en-GB',
  profile: {
    title: 'Your profile',
    sub: 'Each driver profile keeps its own settings.',
    namePlaceholder: 'Your name',
    create: 'Create Profile',
    skip: 'Skip for now',
    tooShort: 'Please enter a name',
    required: 'Your profile name is needed to continue',
    uploadPhoto: 'Upload photo',
    changePhoto: 'Change photo',
    clickPhoto: 'Click to add a photo',
    done: 'Profile created',
  },
  launch: {
    ...american.launch,
    steps: [
      {
        title: 'Start the game',
        text: 'When it says ‘Request to use advanced SDK features detected’, choose OK. That’s Cabin Play.',
      },
      american.launch.steps[1],
    ],
  },
}
