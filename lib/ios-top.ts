/**
 * Haut d'écran de l'appli installée sur iPhone (« écran d'accueil »).
 *
 * Depuis iOS 26, iOS pose un fondu flou « Liquid Glass » sous la barre d'état
 * (heure, réseau, batterie). Il déborde d'environ 32 px sous la zone réservée
 * en haut, et le web ne peut pas le désactiver. Selon les versions, iOS :
 * - déclare la zone réservée (env(safe-area-inset-top) > 0) : on ajoute 32 px
 *   pour passer sous le fondu ;
 * - la déclare à 0 alors que la page passe sous la barre d'état (constaté sur
 *   le téléphone de l'utilisateur, 2026-10-06) : on estime la hauteur de la
 *   barre d'après la taille d'écran, puis on ajoute les 32 px ;
 * - réserve lui-même la barre (la page commence dessous) : rien à faire.
 *
 * Le résultat est posé dans la variable CSS --safe-top, lue par .pt-safe et par
 * StatusBarShield. Hors appli installée sur iPhone (Safari, Android, ordinateur),
 * --safe-top n'existe pas et ils retombent sur env(safe-area-inset-top).
 *
 * Script inline exécuté dans <head>, avant le premier rendu (app/layout.tsx),
 * d'où l'ES5 sans dépendance.
 */
export const IOS_TOP_SCRIPT = `(function(){try{
if(navigator.standalone!==true)return;
var d=document.documentElement;
var BARS={956:62,874:62,932:54,852:54,926:47,844:47,896:48,812:47};
function apply(){
var p=document.createElement('div');
p.style.cssText='position:fixed;visibility:hidden;padding-top:env(safe-area-inset-top)';
d.appendChild(p);
var inset=parseFloat(getComputedStyle(p).paddingTop)||0;
d.removeChild(p);
var h=screen.height,portrait=window.innerHeight>window.innerWidth;
var top=0;
if(inset>0){top=inset+32}
else if(portrait&&window.innerHeight>=h-1){top=(BARS[h]||(h>=812?47:20))+32}
d.style.setProperty('--safe-top',top+'px');
}
apply();
window.addEventListener('resize',apply);
}catch(e){}})()`
