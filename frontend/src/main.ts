import './style.css'
import App from './App.svelte'
import { initFlightLogger } from './lib/stores/flightLogStore'

initFlightLogger()

const app = new App({
  target: document.getElementById('app')
})

export default app
