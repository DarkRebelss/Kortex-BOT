// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Ses kaynağı türleri
 */
export var AudioSource;
(function (AudioSource) {
    AudioSource["YOUTUBE"] = "youtube";
    AudioSource["SPOTIFY"] = "spotify";
    AudioSource["SOUNDCLOUD"] = "soundcloud";
    AudioSource["DIRECT"] = "direct";
})(AudioSource || (AudioSource = {}));
/**
 * Döngü modları
 */
export var LoopMode;
(function (LoopMode) {
    LoopMode["OFF"] = "off";
    LoopMode["SINGLE"] = "single";
    LoopMode["QUEUE"] = "queue";
})(LoopMode || (LoopMode = {}));
/**
 * Oynatıcı durumu
 */
export var PlayerState;
(function (PlayerState) {
    PlayerState["IDLE"] = "idle";
    PlayerState["PLAYING"] = "playing";
    PlayerState["PAUSED"] = "paused";
    PlayerState["BUFFERING"] = "buffering";
    PlayerState["ERROR"] = "error";
})(PlayerState || (PlayerState = {}));
/**
 * Olay tipleri
 */
export var MusicEvent;
(function (MusicEvent) {
    MusicEvent["TRACK_START"] = "trackStart";
    MusicEvent["TRACK_END"] = "trackEnd";
    MusicEvent["TRACK_ERROR"] = "trackError";
    MusicEvent["QUEUE_ADD"] = "queueAdd";
    MusicEvent["QUEUE_EMPTY"] = "queueEmpty";
    MusicEvent["PLAYER_PAUSE"] = "playerPause";
    MusicEvent["PLAYER_RESUME"] = "playerResume";
    MusicEvent["VOICE_DISCONNECT"] = "voiceDisconnect";
})(MusicEvent || (MusicEvent = {}));
//# sourceMappingURL=types.js.map