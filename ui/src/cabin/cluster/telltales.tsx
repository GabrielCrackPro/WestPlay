import type { ReactElement } from 'react'
import type { Telemetry, TruckInfo } from '../../shared/host'
import { useCabin, useLive } from '../state/store'
import type { Strings } from '../state/strings'
import { useText } from '../state/text'
import { DAMAGE_STOP, DAMAGE_WARN, type TruckWarning, truckWarnings } from '../state/warnings'
import {
  AdblueIcon,
  BatteryIcon,
  BeamIcon,
  BeaconIcon,
  BrakeAirIcon,
  FuelIcon,
  HazardIcon,
  IndicatorIcon,
  OilIcon,
  ParkingBrakeIcon,
  PositionLightIcon,
  RetarderIcon,
  TrailerIcon,
  WarningIcon,
  WipersIcon,
} from './ClusterIcons'

/** A telltale: its icon, the label a screen reader reads, and the colour the dash lights it in. */
export interface Telltale {
  key: string
  label: string
  tone: 'ok' | 'info' | 'warn' | 'danger'
  blink?: boolean
  icon: ReactElement
  active: boolean
}

/** The dash's two rows of lamps, and the wear that lights the damage lamp. */
export interface ClusterTelltales {
  /** The lights the driver switches: the indicators, the beams, the running lights and the wipers. */
  lights: Telltale[]
  /** The truck's warnings, nearest the dial where the eye lands. */
  faults: Telltale[]
  /** The truck's worst wear, 0 (new) to 1 (worn out). */
  damage: number
  damageTone: Telltale['tone'] | null
  /** The trailer's worst wear while one is hitched, 0 (new) to 1 (worn out); `null` on a solo run. */
  trailerDamage: number | null
  trailerTone: Telltale['tone'] | null
}

/** Everything the lamp rows are composed from, without the store. */
export interface TelltaleInput {
  telemetry: Telemetry | null
  truck: TruckInfo | null
  /** The warnings card's switch (Settings › Instrument Cluster): off takes the warnings row's marks away. */
  warnings: boolean
  words: Strings['diagnostics']
}

/**
 * The dash's lamp rows for one reading of the truck. Kept apart from the store so the rules — what the warnings switch
 * gates, which slots exist at all, where the damage lamp comes on — can be read and tested without a rendered panel.
 */
export function buildTelltales({ telemetry: t, truck, warnings, words }: TelltaleInput): ClusterTelltales {
  const retarder = t?.retarderLevel ?? 0

  // The lights the driver switches: the indicators first, then the beams, the running lights and the wipers. Each
  // keeps its place even when it is out, so a blinker lighting up never moves the others.
  const lights: Telltale[] = [
    {
      key: 'left',
      label: words.indicatorLeft,
      tone: 'ok',
      blink: true,
      icon: <IndicatorIcon direction="left" />,
      active: t?.leftBlinker ?? false,
    },
    {
      key: 'right',
      label: words.indicatorRight,
      tone: 'ok',
      blink: true,
      icon: <IndicatorIcon direction="right" />,
      active: t?.rightBlinker ?? false,
    },
    {
      key: 'beam',
      label: t?.highBeam ? words.highBeam : words.lowBeam,
      tone: t?.highBeam ? 'info' : 'ok',
      icon: <BeamIcon main={t?.highBeam} />,
      active: (t?.highBeam || t?.lowBeam) ?? false,
    },
    {
      key: 'parkingLight',
      label: words.parkingLight,
      tone: 'ok',
      icon: <PositionLightIcon />,
      active: t?.parkingLight ?? false,
    },
    {
      key: 'beacon',
      label: words.lights,
      tone: 'warn',
      icon: <BeaconIcon />,
      active: t?.beacon ?? false,
    },
    {
      key: 'wipers',
      label: words.wipers,
      tone: 'info',
      icon: <WipersIcon />,
      active: t?.wipers ?? false,
    },
  ]

  // The retarder's own light, on the trucks that have one: lit while the driver holds a step.
  if (truck && truck.retarderSteps > 0) {
    lights.push({
      key: 'retarder',
      label: words.retarder,
      tone: 'info',
      icon: <RetarderIcon />,
      active: retarder > 0,
    })
  }

  // The hitch lamp: lit while a trailer is coupled, out when the truck runs solo, as the dash's own does — and pushed
  // last, so hitching up adds its slot at the end of the row instead of moving the lights already in it.
  if (t?.trailerAttached) {
    lights.push({
      key: 'trailer',
      label: `${words.trailer} ${words.hitched}`,
      tone: 'info',
      icon: <TrailerIcon />,
      active: true,
    })
  }

  // The warnings, grouped as the dash groups them, nearest the dial where the eye lands. The game's five flags come
  // from the shared table, so this row can't fall behind the Overview or the Diagnostics app.
  const warningIcons: Record<TruckWarning, ReactElement> = {
    fuel: <FuelIcon />,
    adblue: <AdblueIcon />,
    battery: <BatteryIcon />,
    oil: <OilIcon />,
    air: <BrakeAirIcon />,
  }
  const faults: Telltale[] = [
    {
      key: 'parkingBrake',
      label: words.parkingBrake,
      tone: 'danger',
      icon: <ParkingBrakeIcon />,
      active: warnings && (t?.parkingBrake ?? false),
    },
    {
      key: 'hazard',
      label: words.hazardLights,
      tone: 'danger',
      blink: true,
      icon: <HazardIcon />,
      active: warnings && (t?.hazard ?? false),
    },
    ...truckWarnings(t, words).map((warning) => ({
      key: warning.key,
      label: warning.label,
      tone: 'danger' as const,
      icon: warningIcons[warning.key],
      active: warnings && warning.on,
    })),
  ]

  // The truck's damage, the worst of its parts: lit amber from 15% and red from 50%, as the game's own warning and
  // stop lamps are (`indicator_warning` and `indicator_stop`).
  const damage = t ? Math.max(t.wearEngine, t.wearWheels, t.wearTransmission, t.wearCabin, t.wearChassis) : 0
  const damageTone: Telltale['tone'] | null = damage >= DAMAGE_STOP ? 'danger' : damage >= DAMAGE_WARN ? 'warn' : null
  if (damageTone) {
    // The damage lamp belongs to the warnings row, so the switch that takes that row off takes this lamp too.
    faults.push({ key: 'damage', label: words.damage, tone: damageTone, icon: <WarningIcon />, active: warnings })
  }

  // The trailer's own wear lamp, while one is on the back: the same warning and stop lines as the truck's, so a worn
  // trailer is not left to the tank card's small row to announce.
  const trailerDamage = t?.trailerAttached
    ? Math.max(t.trailerWearWheels, t.trailerWearBody, t.trailerWearChassis)
    : null
  const trailerTone: Telltale['tone'] | null =
    trailerDamage === null
      ? null
      : trailerDamage >= DAMAGE_STOP
        ? 'danger'
        : trailerDamage >= DAMAGE_WARN
          ? 'warn'
          : null
  if (trailerTone) {
    faults.push({
      key: 'trailerWear',
      label: words.trailerWear,
      tone: trailerTone,
      icon: <TrailerIcon />,
      active: warnings,
    })
  }

  return { lights, faults, damage, damageTone, trailerDamage, trailerTone }
}

/**
 * The lamp rows as the dash lights them now, from the same telemetry the rest of the panel reads. The Settings
 * preview draws them from here too, so the picture can't claim a lamp the dash isn't showing.
 */
export function useClusterTelltales(): ClusterTelltales {
  const words = useText().diagnostics
  const telemetry = useLive((state) => state.telemetry)
  const truck = useLive((state) => state.truck)
  const warnings = useCabin((state) => state.clusterCards.warnings)
  return buildTelltales({ telemetry, truck, warnings, words })
}
