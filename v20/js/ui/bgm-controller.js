const AUDIO_SRC="./assets/audio/alley-wind.m4a?v=alpha32-221";
const VOLUME_KEY="wealth-empire-bgm-volume-v1";
const MUTED_KEY="wealth-empire-bgm-muted-v1";
const DEFAULT_VOLUME=.45;
const PHONE_AUDIO_QUERY="(hover:none) and (pointer:coarse)";

function clampVolume(value){
  const number=Number(value);
  return Number.isFinite(number)?Math.min(1,Math.max(0,number)):DEFAULT_VOLUME;
}

function readSetting(key,fallback){
  try{
    const value=localStorage.getItem(key);
    return value===null?fallback:value;
  }catch{
    return fallback;
  }
}

function writeSetting(key,value){
  try{localStorage.setItem(key,String(value))}catch{}
}

export function initBgmController(){
  const controls=document.getElementById("desktopBgmControls");
  const muteButton=document.getElementById("bgmMuteButton");
  const volumeSlider=document.getElementById("bgmVolumeSlider");
  const volumeValue=document.getElementById("bgmVolumeValue");
  const status=document.getElementById("bgmStatus");
  if(!controls||!muteButton||!volumeSlider||!volumeValue||!status)return null;

  const audio=new Audio(AUDIO_SRC);
  audio.loop=true;
  audio.preload="none";
  audio.autoplay=false;
  audio.playsInline=true;

  const phoneUsesDeviceVolume=window.matchMedia?.(PHONE_AUDIO_QUERY)?.matches===true;
  let volume=clampVolume(readSetting(VOLUME_KEY,DEFAULT_VOLUME));
  let muted=readSetting(MUTED_KEY,"false")==="true";
  let playPending=false;
  let started=false;

  const applyAudioSettings=()=>{
    if(phoneUsesDeviceVolume){
      audio.volume=1;
      audio.muted=false;
      return;
    }
    audio.volume=volume;
    audio.muted=muted;
  };

  const render=()=>{
    applyAudioSettings();
    volumeSlider.value=String(volume);
    volumeValue.value=`${Math.round(volume*100)}%`;
    volumeValue.textContent=volumeValue.value;
    muteButton.setAttribute("aria-pressed",String(muted));
    muteButton.textContent=muted?"靜音":"聲音";
    muteButton.setAttribute("aria-label",muted?"恢復背景音樂":"靜音背景音樂");
    controls.dataset.deviceVolume=phoneUsesDeviceVolume?"true":"false";
  };

  const disarmGestureStart=()=>{
    document.removeEventListener("pointerdown",tryStart,true);
    document.removeEventListener("keydown",tryStart,true);
    document.removeEventListener("touchend",tryStart,true);
  };

  async function tryStart(){
    if(started||playPending)return;
    playPending=true;
    audio.preload="auto";
    status.textContent="BGM 載入中";
    try{
      await audio.play();
      started=true;
      status.textContent="播放中";
      disarmGestureStart();
    }catch(error){
      status.textContent="再次操作即可播放";
      if(error?.name!=="NotAllowedError")console.warn("BGM playback unavailable",error);
    }finally{
      playPending=false;
    }
  }

  render();
  document.addEventListener("pointerdown",tryStart,true);
  document.addEventListener("keydown",tryStart,true);
  document.addEventListener("touchend",tryStart,true);

  muteButton.addEventListener("click",()=>{
    if(phoneUsesDeviceVolume)return;
    muted=!muted;
    writeSetting(MUTED_KEY,muted);
    render();
    void tryStart();
  });

  volumeSlider.addEventListener("input",()=>{
    if(phoneUsesDeviceVolume)return;
    volume=clampVolume(volumeSlider.value);
    writeSetting(VOLUME_KEY,volume);
    render();
  });
  volumeSlider.addEventListener("change",()=>void tryStart());

  audio.addEventListener("playing",()=>{
    started=true;
    status.textContent="播放中";
    disarmGestureStart();
  });
  audio.addEventListener("error",()=>{
    status.textContent="BGM 載入失敗";
  });

  window.addEventListener("pagehide",()=>audio.pause(),{once:true});
  return{audio,tryStart,phoneUsesDeviceVolume};
}
