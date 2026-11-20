import { Link } from "react-router-dom";

import logoIcon from "../assets/bilder til nettsiden/Ikoner og Bilder/Logo Østfold.png";
import facebookIcon from "../assets/bilder til nettsiden/Ikoner og Bilder/Facebook1.png";
import instagramIcon from "../assets/bilder til nettsiden/Ikoner og Bilder/instagram1.png";

function Footer() {    
  return (  
    <footer className="footer">
            <Link className="brand" to="/">
              <img
                className="footer-logo"
                src={logoIcon}
                alt="Østfold Husflidslag"
              />
            </Link>

            <p>Tradisjon | Kreativitet | Fellesskap</p>

            <nav
              className="footer-links"
              aria-label="Kontakt og sosiale medier"
            >
              <a href="#" aria-label="Facebook">
                <img src={facebookIcon} alt="" />
                Facebook
              </a>

              <a href="#" aria-label="Instagram">
                <img src={instagramIcon} alt="" />
                Instagram
              </a>

              <Link to="/kontakt">
                Kontakt oss →
              </Link>
            </nav>
    </footer>
  );
}

export default Footer;