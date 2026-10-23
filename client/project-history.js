export const portalScreens=['welcome','project','estimate','design','progress','messages','requests','schedule','payments','documents','learning','feedback','aftercare'];
export function createPortalNavigation({history,location,events}){
  const listeners=new Set();
  const readScreen=()=>{const value=new URLSearchParams(location.search).get('view');return portalScreens.includes(value)?value:'welcome';};
  let route={d2Portal:true,screen:readScreen(),overlay:null,depth:0};
  const url=screen=>location.pathname+(screen==='welcome'?'':'?view='+encodeURIComponent(screen));
  const emit=()=>{for(const listener of listeners)listener(route);};
  history.replaceState(route,'',url(route.screen));
  events.addEventListener('popstate',event=>{route=event.state?.d2Portal?event.state:{d2Portal:true,screen:readScreen(),overlay:null,depth:0};emit();});
  function navigate(screen){if(!portalScreens.includes(screen))return;if(route.screen===screen&&!route.overlay)return;route={d2Portal:true,screen,overlay:null,depth:route.depth+1};history.pushState(route,'',url(screen));emit();}
  return {
    current:()=>route,
    subscribe(listener){listeners.add(listener);listener(route);return ()=>listeners.delete(listener);},
    navigate,
    openOverlay(type,data={}){const replacing=route.overlay?.type===type;route={...route,overlay:{...data,type},depth:route.depth+(replacing?0:1)};history[replacing?'replaceState':'pushState'](route,'',url(route.screen));emit();},
    closeOverlay(){if(route.overlay)history.back();},
    back(){if(route.depth>0)history.back();else if(route.screen!=='welcome')navigate('welcome');}
  };
}
let navigation;
export function getPortalNavigation(){return navigation||=createPortalNavigation({history:window.history,location:window.location,events:window});}
