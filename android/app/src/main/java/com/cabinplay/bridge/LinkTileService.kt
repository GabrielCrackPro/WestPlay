package com.cabinplay.bridge

import android.content.Intent
import android.service.quicksettings.Tile
import android.service.quicksettings.TileService

/** The link in the phone's Quick Settings: one tap to connect or disconnect. */
class LinkTileService : TileService() {
    override fun onStartListening() {
        super.onStartListening()
        val live = PhoneHub.phase == LinkPhase.Live
        qsTile?.apply {
            state = if (live) Tile.STATE_ACTIVE else Tile.STATE_INACTIVE
            label = getString(R.string.tile_label)
            updateTile()
        }
    }

    override fun onClick() {
        super.onClick()
        if (Pairing.load(this) == null) {
            startActivityAndCollapse(Intent(this, MainActivity::class.java))
            return
        }
        if (PhoneHub.phase == LinkPhase.Live) {
            LinkService.stop(this)
            PhoneHub.setStatus(getString(R.string.disconnected), LinkPhase.Idle)
        } else {
            LinkService.start(this)
        }
        onStartListening()
    }
}
