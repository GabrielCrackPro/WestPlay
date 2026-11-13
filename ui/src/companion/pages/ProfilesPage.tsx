import { call } from '../bridge'
import { Button, Group, Note, Panel, Row } from '../room/parts'
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

/** The profiles page: manage driver profiles with their own settings. */
export function ProfilesPage({ cw }: { cw: CompanionWords }) {
  const { settings, update, error } = useSettings()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [picture, setPicture] = useState<string>('')
  const [editingPicId, setEditingPicId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const addFileInputRef = useRef<HTMLInputElement>(null)

  if (!settings) return null

  const profiles = settings.cabin.profiles
  const currentId = settings.cabin.currentProfileId

  const handleAdd = async () => {
    if (!name.trim()) return
    try {
      const updated = await call<Settings>('add_profile', { name: name.trim(), picture })
      update(updated)
      setName('')
      setPicture('')
      setAdding(false)
    } catch { /* settings-changed event will update */ }
  }

  const handleSwitch = async (id: string) => {
    try {
      const updated = await call<Settings>('switch_profile', { id })
      update(updated)
    } catch { /* settings-changed event will update */ }
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

      <Group place={4}>
        {profiles.length === 0 && (
          <Row title={cw.profiles.currentProfile} value={cw.profiles.noProfile} />
        )}
        {profiles.length > 0 && (
          <Row title={cw.profiles.currentProfile} value={currentProfile?.name} />
        )}
        {profiles.map((profile) => {
          const isCurrent = profile.id === currentId
          const isEditing = editingPicId === profile.id
          return (
            <div key={profile.id} className="cp-profile-row">
              <label
                className="cp-profile-pic-btn"
                onClick={() => !isCurrent && handleSwitch(profile.id)}
              >
                {profile.picture ? (
                  <img className="cp-profile-pic" src={profile.picture} alt="" />
                ) : (
                  <span className="cp-profile-avatar">{(profile.name ?? '?')[0]?.toUpperCase() ?? '?'}</span>
                )}
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
              </label>
              <span className="cp-profile-row-name">
                <span onClick={() => !isCurrent && handleSwitch(profile.id)}>{profile.name}</span>
                {isCurrent && <span className="cp-profile-row-current">{cw.profiles.current}</span>}
              </span>
              <Button
                small
                glass
                onClick={() => {
                  setEditingPicId(profile.id)
                  window.setTimeout(() => fileInputRef.current?.click(), 50)
                }}
              >
                {cw.profiles.photo}
              </Button>
            </div>
          )
        })}
      </Group>

      <Group place={5}>
        {adding ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <label
                style={{
                  display: 'grid',
                  width: 40,
                  height: 40,
                  placeItems: 'center',
                  borderRadius: '50%',
                  border: '2px dashed rgb(255 255 255 / 0.2)',
                  background: 'var(--fill)',
                  cursor: 'pointer',
                  overflow: 'hidden',
                  flexShrink: 0,
                }}
                onClick={() => addFileInputRef.current?.click()}
              >
                {picture ? (
                  <img style={{ width: '100%', height: '100%', objectFit: 'cover' }} src={picture} alt="" />
                ) : (
                  <span style={{ color: 'var(--text-faint)', fontSize: 18 }}>+</span>
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
                style={{ flex: 1 }}
              />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button small onClick={handleAdd} disabled={!name.trim()}>{cw.profiles.save}</Button>
              <Button glass small onClick={() => { setAdding(false); setName(''); setPicture('') }}>{cw.profiles.cancel}</Button>
            </div>
          </div>
        ) : (
          <Row title={cw.profiles.addProfile} link onClick={() => setAdding(true)} />
        )}
      </Group>
      <Note>{cw.profiles.addProfileFooter}</Note>
    </Panel>
  )
}
