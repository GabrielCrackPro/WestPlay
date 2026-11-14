import { call } from '../bridge'
import { Button, Group, Note, Panel, Row, Tick } from '../room/parts'
import { type Settings, useSettings } from '../useSettings'
import { SectionGlyph } from './glyphs'
import { type CompanionWords } from './words'
import { useRef, useState } from 'react'

function readPicture(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const size = 128
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')!
        const min = Math.min(img.width, img.height)
        const sx = (img.width - min) / 2
        const sy = (img.height - min) / 2
        ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size)
        resolve(canvas.toDataURL('image/jpeg', 0.7))
      }
      img.src = String(reader.result)
    }
    reader.readAsDataURL(file)
  })
}

function RemoveGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
      <path d="M8 8l8 8M16 8l-8 8" />
    </svg>
  )
}

function CameraGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
      <circle cx="12" cy="13" r="4"/>
    </svg>
  )
}

/** A single profile card: avatar (clickable for photo), name, current badge, and remove button. */
function ProfileCard({
  profile,
  isCurrent,
  onSwitch,
  onPhoto,
  onRemove,
  cw,
}: {
  profile: { id: string; name: string; picture?: string }
  isCurrent: boolean
  onSwitch: () => void
  onPhoto: () => void
  onRemove: () => void
  cw: CompanionWords
}) {
  return (
    <div className="cp-profile-card" data-current={isCurrent || undefined}>
      <button type="button" className="cp-profile-card-switch" onClick={onSwitch} aria-pressed={isCurrent}>
        <label className="cp-profile-card-avatar-wrap" onClick={(e) => {
          e.stopPropagation()
          onPhoto()
        }}>
          <div className="cp-profile-card-avatar">
            {profile.picture ? (
              <img className="cp-profile-card-pic" src={profile.picture} alt="" />
            ) : (
              <span className="cp-profile-card-initial">
                {(profile.name ?? '?')[0]?.toUpperCase() ?? '?'}
              </span>
            )}
            {isCurrent && <span className="cp-profile-card-ring" />}
            <span className="cp-profile-card-camera">
              <CameraGlyph />
            </span>
          </div>
        </label>
        <div className="cp-profile-card-info">
          <span className="cp-profile-card-name">{profile.name}</span>
          {isCurrent ? (
            <span className="cp-profile-card-badge">
              <i className="cp-profile-card-check" />
              {cw.profiles.current}
            </span>
          ) : (
            <span className="cp-profile-card-hint">{cw.profiles.switch}</span>
          )}
        </div>
        {isCurrent && <Tick done />}
      </button>
      <div className="cp-profile-card-actions">
        {!isCurrent && (
          <Button small glass danger onClick={onRemove}>
            <RemoveGlyph />
          </Button>
        )}
      </div>
    </div>
  )
}

/** The profiles page: manage driver profiles with their own settings. */
export function ProfilesPage({ cw }: { cw: CompanionWords }) {
  const { settings, update, error } = useSettings()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [picture, setPicture] = useState<string>('')
  const [editingPicId, setEditingPicId] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const addFileInputRef = useRef<HTMLInputElement>(null)

  if (!settings) return null

  const profiles = settings.cabin.profiles
  const currentId = settings.cabin.currentProfileId

  const handleAdd = async () => {
    if (!name.trim()) return
    try {
      const updated = await call<Settings>('add_profile', { name: name.trim(), picture, settingsSnapshot: null })
      update(updated)
      setName('')
      setPicture('')
      setAdding(false)
    } catch { /* settings-changed event will update */ }
  }

  const handleSwitch = async (id: string) => {
    try {
      const updated = await call<Settings>('switch_profile', { id, currentSnapshot: null })
      update(updated)
    } catch { /* settings-changed event will update */ }
  }

  const handleRemove = async (id: string) => {
    try {
      const updated = await call<Settings>('remove_profile', { id })
      update(updated)
    } catch { /* settings-changed event will update */ }
    setRemovingId(null)
  }

  const handleUpdatePicture = async (id: string, pic: string) => {
    try {
      const updated = await call<Settings>('update_profile_picture', { id, picture: pic })
      update(updated)
    } catch { /* settings-changed event will update */ }
    setEditingPicId(null)
  }

  const currentProfile = profiles.find((p) => p.id === currentId)

  return (
    <Panel place="page" title={cw.profiles.title} sub={cw.profiles.sub} icon={<SectionGlyph id="profiles" />}>
      {error && <Note tone="bad">{error}</Note>}

      {profiles.length > 0 && (
        <Group place={4}>
          <Row title={cw.profiles.currentProfile} value={currentProfile?.name} />
        </Group>
      )}

      <Group place={5}>
        {profiles.length === 0 && (
          <div className="cp-profiles-empty">
            <span className="cp-profiles-empty-icon" aria-hidden>+</span>
            <span>{cw.profiles.noProfilesYet}</span>
          </div>
        )}
        <div className="cp-profile-grid">
          {profiles.map((profile) => {
            const isCurrent = profile.id === currentId
            const isEditing = editingPicId === profile.id
            const isRemoving = removingId === profile.id
            return (
              <div key={profile.id} className="cp-profile-grid-item">
                <ProfileCard
                  profile={profile}
                  isCurrent={isCurrent}
                  onSwitch={() => !isCurrent && handleSwitch(profile.id)}
                  onPhoto={() => {
                    setEditingPicId(profile.id)
                    window.setTimeout(() => fileInputRef.current?.click(), 50)
                  }}
                  onRemove={() => {
                    if (isRemoving) {
                      handleRemove(profile.id)
                    } else {
                      setRemovingId(profile.id)
                      window.setTimeout(() => setRemovingId(null), 3000)
                    }
                  }}
                  cw={cw}
                />
                <input
                  ref={isEditing ? fileInputRef : null}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      const pic = await readPicture(file)
                      handleUpdatePicture(profile.id, pic)
                    }
                  }}
                />
              </div>
            )
          })}
        </div>
      </Group>

      <Group place={6}>
        {adding ? (
          <div className="cp-add-profile">
            <div className="cp-add-profile-row">
              <label
                className="cp-add-profile-pic"
                onClick={() => addFileInputRef.current?.click()}
              >
                {picture ? (
                  <img className="cp-add-profile-pic-img" src={picture} alt="" />
                ) : (
                  <span aria-hidden>+</span>
                )}
                <input
                  ref={addFileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (file) setPicture(await readPicture(file))
                  }}
                />
              </label>
              <input
                type="text"
                className="ob-input"
                placeholder={cw.profiles.profileNamePlaceholder}
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAdd()
                  if (e.key === 'Escape') { setAdding(false); setName(''); setPicture('') }
                }}
                autoFocus
              />
            </div>
            <div className="cp-add-profile-buttons">
              <Button small onClick={handleAdd} disabled={!name.trim()}>
                {cw.profiles.save}
              </Button>
              <Button glass small onClick={() => { setAdding(false); setName(''); setPicture('') }}>
                {cw.profiles.cancel}
              </Button>
            </div>
          </div>
        ) : (
          <Row title={cw.profiles.addProfile} link onClick={() => setAdding(true)} />
        )}
      </Group>
      <Note tone="calm">{cw.profiles.addProfileFooter}</Note>
    </Panel>
  )
}
